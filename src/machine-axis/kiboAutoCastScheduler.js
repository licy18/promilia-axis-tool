const AUTO_CAST_KINDS = new Set(['normal-attack', 'active']);
const USER_KIBO_ACTION_KINDS = new Set(['signature', 'break']);
const UNCONDITIONAL_TRIGGER_TAG = '0';

/**
 * 奇波普攻/主动技自动释放时间轴补齐。
 *
 * 规则来源：`C:\PC2\Codex\AzPr\work\blue-origin-mechanics-review\pet-skill-release-mechanics.md`
 * - 槽 1（normal-attack）与槽 2（active）均为自动释放技能，玩家只拖入大招/合击等指令动作；
 * - 自动释放受主冷却（coolDown）、同 selfCDGroup 互锁（selfCD）、全局 GCD 与技能占用约束；
 * - 大招/合击占用期间（PetUltimate/JointStrikeSkill，行为树停止）不自动释放；
 * - petSkillLogicTag=0 为无条件释放，事件类（80/10|7/10/5#2）在排轴器按“就绪即释放”简化建模，
 *   触发语义以 `autoCastRule.evidenceStatus='planner-simplified'` 显式登记，不冒充实机精确事件。
 */
export function expandKiboAutoCastActions(
  contract,
  { kiboCatalogById, fps = 60 } = {}
) {
  const sourceActions = Array.isArray(contract?.actions)
    ? contract.actions
    : [];
  const team = contract?.scenario?.team ?? [];
  const horizonFrames = Number(contract?.scenario?.durationFrames) || 0;
  if (!(horizonFrames > 0)) return sourceActions;

  const userActionsBySlot = new Map();
  for (const action of sourceActions) {
    if (action?.owner?.kind !== 'kibo') continue;
    if (!USER_KIBO_ACTION_KINDS.has(String(action.intent?.actionKind ?? ''))) {
      continue;
    }
    const slotId = String(action.owner.slotId ?? '');
    if (!slotId) continue;
    const rows = userActionsBySlot.get(slotId) ?? [];
    rows.push(action);
    userActionsBySlot.set(slotId, rows);
  }

  const generated = [];
  for (const slot of team) {
    const kiboId = Number(slot.loadout?.kiboId);
    if (!Number.isInteger(kiboId) || kiboId <= 0) continue;
    const kibo = kiboCatalogById?.get(kiboId);
    if (!kibo) continue;
    const userActions = userActionsBySlot.get(String(slot.slotId)) ?? [];
    if (userActions.length === 0) continue;
    const autoSkills = (kibo.actions ?? []).filter(action =>
      AUTO_CAST_KINDS.has(String(action.kind))
    );
    if (autoSkills.length === 0) continue;
    const skillByAction = new Map(
      (kibo.actions ?? []).map(action => [
        `${Number(action.skillId)}|${action.kind}`,
        action,
      ])
    );
    generated.push(
      ...scheduleKiboAutoCasts({
        kiboId,
        slotId: String(slot.slotId),
        autoSkills,
        userActions,
        skillByAction,
        horizonFrames,
        fps,
      })
    );
  }
  return generated.length ? [...sourceActions, ...generated] : sourceActions;
}

function scheduleKiboAutoCasts({
  kiboId,
  slotId,
  autoSkills,
  userActions,
  skillByAction,
  horizonFrames,
  fps,
}) {
  const actions = [];
  const nextReadyBySkillId = new Map();
  const selfGroupLockUntil = new Map();
  let gcdLockUntil = 0;
  const busyWindows = userActions
    .map(action => {
      const catalog = skillByAction.get(
        `${Number(action.intent?.publicActionId)}|${action.intent?.actionKind}`
      );
      return {
        start: Math.max(0, Number(action.schedule?.frame) || 0),
        duration: positiveInteger(catalog?.durationFrames) ?? 0,
        catalog,
      };
    })
    .filter(busyWindow => busyWindow.duration > 0)
    .sort((left, right) => left.start - right.start || right.duration - left.duration);

  const skills = [...autoSkills]
    .sort((left, right) => {
      const priority = { active: 0, 'normal-attack': 1 };
      return (priority[left.kind] ?? 2) - (priority[right.kind] ?? 2);
    })
    .map(skill => ({
      kind: String(skill.kind),
      skillId: Number(skill.skillId),
      durationFrames: positiveInteger(skill.durationFrames) ?? 1,
      cooldownFrames: msToFrames(skill.cooldownMs, fps),
      selfCooldownFrames: msToFrames(skill.selfCooldownMs, fps),
      selfCooldownGroup: positiveInteger(skill.selfCooldownGroup) ?? null,
      gcdFrames: msToFrames(skill.gcdMs, fps),
      triggerTag: String(skill.petSkillLogicTag ?? ''),
    }));

  let frame = 0;
  let sequence = 0;
  while (frame < horizonFrames) {
    const busy = busyWindows.find(
      busyWindow =>
        frame >= busyWindow.start && frame < busyWindow.start + busyWindow.duration
    );
    if (busy) {
      const busyLocks = applyCastLocks(busy.catalog, frame, {
        nextReadyBySkillId,
        selfGroupLockUntil,
        fps,
      });
      gcdLockUntil = Math.max(gcdLockUntil, busyLocks.gcdLockUntil);
      frame = busy.start + busy.duration;
      continue;
    }
    const nextBusyStart =
      busyWindows
        .map(busyWindow => busyWindow.start)
        .filter(start => start > frame)
        .sort((left, right) => left - right)[0] ?? horizonFrames;
    const candidate = skills.find(skill => {
      const ready =
        frame >= (nextReadyBySkillId.get(skill.skillId) ?? 0) &&
        (skill.selfCooldownGroup == null ||
          frame >=
            (selfGroupLockUntil.get(skill.selfCooldownGroup) ?? 0)) &&
        frame >= gcdLockUntil;
      return (
        ready &&
        frame + skill.durationFrames <= nextBusyStart &&
        frame + skill.durationFrames <= horizonFrames
      );
    });
    if (candidate) {
      sequence += 1;
      const autoCastRule = {
        source: 'azpr-kibo-auto-cast',
        trigger:
          candidate.triggerTag === UNCONDITIONAL_TRIGGER_TAG
            ? 'unconditional'
            : 'event-triggered',
        triggerTag: candidate.triggerTag || null,
        priority: 'active-before-normal',
        evidenceStatus:
          candidate.triggerTag === UNCONDITIONAL_TRIGGER_TAG
            ? 'static-evidence-closed'
            : 'planner-simplified',
      };
      actions.push({
        id: `kibo-${kiboId}-${slotId}-auto-${candidate.kind}-${sequence}`,
        owner: { kind: 'kibo', slotId },
        intent: {
          kind: 'public-action',
          publicActionId: candidate.skillId,
          actionKind: candidate.kind,
          level: 1,
          autoCast: true,
        },
        schedule: {
          mode: 'absolute',
          frame,
          offsetFrames: 0,
        },
        note: 'kibo-auto-cast',
        autoCast: true,
        autoCastRule,
        hitOverrides: {},
      });
      nextReadyBySkillId.set(
        candidate.skillId,
        frame + candidate.cooldownFrames
      );
      if (candidate.selfCooldownGroup != null) {
        selfGroupLockUntil.set(
          candidate.selfCooldownGroup,
          frame + candidate.selfCooldownFrames
        );
      }
      gcdLockUntil = Math.max(
        gcdLockUntil,
        frame + candidate.gcdFrames
      );
      frame += candidate.durationFrames;
      continue;
    }
    frame += 1;
  }
  return actions;
}

function applyCastLocks(
  catalog,
  castFrame,
  { nextReadyBySkillId, selfGroupLockUntil, fps }
) {
  const skillId = Number(catalog?.skillId);
  if (Number.isInteger(skillId) && skillId > 0) {
    nextReadyBySkillId.set(
      skillId,
      Math.max(
        nextReadyBySkillId.get(skillId) ?? 0,
        castFrame + msToFrames(catalog.cooldownMs, fps)
      )
    );
  }
  const group = positiveInteger(catalog?.selfCooldownGroup);
  if (group != null) {
    selfGroupLockUntil.set(
      group,
      Math.max(
        selfGroupLockUntil.get(group) ?? 0,
        castFrame + msToFrames(catalog.selfCooldownMs, fps)
      )
    );
  }
  return {
    gcdLockUntil: castFrame + msToFrames(catalog.gcdMs, fps),
  };
}

function msToFrames(ms, fps) {
  const normalized = Number(ms);
  return Number.isFinite(normalized) && normalized > 0
    ? Math.ceil((normalized / 1000) * fps)
    : 0;
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
