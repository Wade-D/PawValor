import { _decorator, Component, Label, Node, Graphics, Color, UITransform, view } from 'cc';
import { rainePrototypeConfig } from '../config/raine.prototype';
import { validateGameConfig } from '../core/validate-config';
import { DemoWorld } from '../core/demo-world';
import { FixedStepDriver } from '../core/demo-fixed-step';
import { PIXELS_PER_UNIT, DemoEntitySnapshot } from '../core/demo-model';
import { DemoInput } from './DemoInput';
import { createCombatPreset, CombatPresetId } from '../config/combat-presets.prototype';
import { CombatEffectPanel } from './CombatEffectPanel';
import { GrowthCombatRun } from '../core/growth-combat-run';
import { presentGrowth } from '../core/growth-presentation';
import { growthPrototype } from '../config/growth.prototype';
import { growthCopyPrototype } from '../config/growth-copy.prototype';
import { growthPlaytestPrototype } from '../config/growth-playtest.prototype';
import { GrowthChoicePanel } from './GrowthChoicePanel';
import { GrowthPlaytestControls } from './GrowthPlaytestControls';
import type { GrowthEvent } from '../core/growth-model';

const { ccclass, property } = _decorator;

@ccclass('CombatDemo')
export class CombatDemo extends Component {
  @property(Node) worldRoot: Node | null = null;
  @property(Label) hudLabel: Label | null = null;
  @property(Label) statusLabel: Label | null = null;
  @property(Node) joystickBase: Node | null = null;
  @property(Node) joystickKnob: Node | null = null;
  private world: DemoWorld | null = null;
  private growthRun: GrowthCombatRun | null = null;
  private choices: GrowthChoicePanel | null = null;
  private playtest: GrowthPlaytestControls | null = null;
  private entryRevision = 0;
  private inputRevision = -1;
  private readonly growthFixture = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('growthFixture') === 'sword-rain';
  private controls: DemoInput | null = null;
  private readonly driver = new FixedStepDriver();
  private readonly markers = new Map<string, Node>();
  private panel: CombatEffectPanel | null = null;
  private preset = createCombatPreset('basic');
  // 仅供本地多目标验收；默认玩法仍使用原生成规则。
  private readonly fixtureTargets = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('combatFixture') === 'secondary'
    ? [{ x: 2, y: 0 }, { x: 2.3, y: 0.3 }, { x: 4, y: 0 }] : undefined;

  onLoad(): void {
    view.setDesignResolutionSize(1280, 720, 2);
    const issues = validateGameConfig(rainePrototypeConfig);
    if (issues.length) {
      const message = issues.map(issue => `${issue.code} ${issue.path}: ${issue.message}`).join('\n');
      if (this.statusLabel) this.statusLabel.string = '配置校验失败，请查看控制台';
      console.error('[CombatDemo] Configuration rejected\n' + message);
      return;
    }
    if (!this.worldRoot || !this.hudLabel || !this.statusLabel || !this.joystickBase || !this.joystickKnob) {
      console.error('[CombatDemo] Required scene binding missing; combat disabled');
      if (this.statusLabel) this.statusLabel.string = '场景绑定缺失，战斗已停用';
      return;
    }
    this.controls = this.getComponent(DemoInput) ?? this.addComponent(DemoInput);
    this.controls.onRestart = () => this.restartRun();
    this.drawCircle(this.joystickBase, 70, new Color(40, 60, 85, 150));
    this.drawCircle(this.joystickKnob, 25, new Color(120, 190, 220, 200));
    this.panel = this.addComponent(CombatEffectPanel);
    this.panel.initialize(this.worldRoot, id => this.selectPreset(id), () => this.selectGrowth());
    this.choices = this.addComponent(GrowthChoicePanel);
    this.choices.initialize(this.worldRoot.parent!, {
      select: (token, id) => { const result = this.growthRun?.select(token, id); if (result) this.consumeGrowth(result.events); this.syncInput(); this.render(); },
      reroll: token => { const result = this.growthRun?.reroll(token); if (result) this.consumeGrowth(result.events); this.syncInput(); this.render(); },
      restart: () => this.restartRun(), retry: () => { this.consumeGrowth(this.growthRun?.retryGrowth() ?? []); this.syncInput(); this.render(); },
    });
    this.playtest = this.addComponent(GrowthPlaytestControls);
    this.selectGrowth(false);
    console.info('[CombatDemo] Configuration valid; prototype combat ready');
    this.render();
  }

  startRun(): void { this.growthRun?.start(); if (this.world?.snapshot().state === 'idle') this.world.start(); this.resetTiming(); this.render(); }
  pauseRun(): void { this.growthRun?.pause(); this.world?.pause(); this.syncInput(); this.resetTiming(); this.render(); }
  resumeRun(): void { this.growthRun?.resume(); this.world?.resume(); this.resetTiming(); this.render(); }
  restartRun(): void {
    if (this.growthRun) { this.selectGrowth(true); return; }
    if (!this.world) return;
    this.resetTiming();
    this.clearMarkers();
    this.panel?.clear();
    this.world.reset();
    this.world.start();
    this.render();
    console.info('[CombatDemo] Restart', this.world.snapshot().hero.handle.generation);
  }

  update(dt: number): void {
    if (!this.controls || this.currentSnapshot()?.state !== 'running') return;
    const result = this.driver.advance(dt, step => {
      if (this.currentSnapshot()?.state !== 'running') return;
      const result = this.growthRun?.step(step, this.controls!.movement);
      const events = result?.combatEvents ?? this.world!.step(step, this.controls!.movement);
      this.panel?.consume(events);
      if (result) this.consumeGrowth(result.growthEvents);
      this.syncInput();
      for (const event of events) {
        if (event.type !== 'enemySpawn') console.info('[CombatDemo]', event.type, event);
      }
    });
    if (result.droppedSeconds > 0) console.warn('[CombatDemo] Catch-up time dropped', result.droppedSeconds);
    if (this.currentSnapshot()?.state === 'ended') this.resetTiming();
    this.render();
  }

  private resetTiming(): void { this.driver.reset(); this.controls?.clear(); }

  private currentSnapshot() { return this.growthRun?.snapshot().world ?? this.world?.snapshot(); }
  private syncInput(): void {
    const revision = this.growthRun?.snapshot().inputRevision ?? -1;
    // 先锁存尚未松开的移动键，再清理固定步和输入。
    this.controls?.setGameplayBlocked(this.currentSnapshot()?.state !== 'running');
    if (revision !== this.inputRevision) { this.inputRevision = revision; this.resetTiming(); }
  }
  private consumeGrowth(events: readonly GrowthEvent[]): void {
    this.choices?.consume(events, this.currentSnapshot()?.elapsedSeconds ?? 0);
    for (const event of events) console.info('[CombatDemo]', event.type, event);
  }
  private clearEntry(): void {
    this.entryRevision++; this.controls?.setGameplayBlocked(true); this.resetTiming(); this.clearMarkers();
    this.panel?.clear(); this.choices?.clear(); this.playtest?.clear(); this.world = null; this.growthRun = null; this.inputRevision = -1;
  }
  private selectGrowth(start = true): void {
    this.clearEntry();
    this.growthRun = new GrowthCombatRun(rainePrototypeConfig, { heroId: 'raine', ...growthPrototype,
      ...(this.growthFixture ? { seed: growthPlaytestPrototype.seed, world: growthPlaytestPrototype.world } : {}) });
    if (start) this.growthRun.start(); this.syncInput(); this.render();
    if (this.growthFixture) {
      const entry = this.entryRevision;
      this.playtest?.initialize(this.worldRoot!.parent!, {
        prepare: () => {
          if (entry !== this.entryRevision) return; this.selectGrowth(true);
          for (const command of growthPlaytestPrototype.commands) {
            const token = this.growthRun!.snapshot().growth.token;
            if (command.kind === 'grantXp') this.consumeGrowth(this.growthRun!.grantXp(command.amount));
            else {
              if (!token) throw new Error('测试入口缺少当前选择。');
              const result = command.kind === 'reroll' ? this.growthRun!.reroll(token) : this.growthRun!.select(token, command.optionId);
              if (!result.ok) throw new Error('测试入口的正常成长命令被拒绝。'); this.consumeGrowth(result.events);
            }
          }
          this.syncInput(); this.render();
        },
        grantXp: amount => { if (entry !== this.entryRevision || !this.growthRun) return; this.consumeGrowth(this.growthRun.grantXp(amount)); this.syncInput(); this.render(); },
      });
    }
  }

  private selectPreset(id: CombatPresetId): void {
    this.clearEntry();
    this.preset = createCombatPreset(id);
    this.world = this.createWorld();
    this.world.start(); this.syncInput(); this.render();
  }

  private createWorld(): DemoWorld {
    return new DemoWorld(this.preset.config, { ...this.preset.options, initialEnemyPositions: this.fixtureTargets });
  }

  private drawCircle(node: Node, radius: number, color: Color): void {
    const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
    graphics.clear(); graphics.fillColor = color;
    graphics.circle(0, 0, radius); graphics.fill();
  }

  private render(): void {
    if (!this.worldRoot) return;
    const state = this.currentSnapshot(); if (!state) return; this.syncInput();
    const live = new Set<string>();
    const marker = (entity: DemoEntitySnapshot, kind: string, radius: number, color: Color): Node => {
      const key = `${kind}:${entity.handle.generation}:${entity.handle.id}`;
      live.add(key);
      let node = this.markers.get(key);
      if (!node) {
        node = new Node(key); node.layer = this.worldRoot!.layer;
        node.addComponent(UITransform).setContentSize(radius * 2, radius * 2);
        this.worldRoot!.addChild(node); this.drawCircle(node, radius, color);
        this.markers.set(key, node);
      }
      node.setPosition(entity.position.x * PIXELS_PER_UNIT, entity.position.y * PIXELS_PER_UNIT);
      return node;
    };
    for (const orb of state.orbs) marker(orb, 'xp', 9, new Color(90, 245, 165));
    for (const enemy of state.enemies) marker(enemy, 'enemy', 22.4, new Color(235, 95, 105));
    for (const sword of state.projectiles) {
      const color = sword.kind === 'synergy' ? new Color(60, 240, 245) : sword.kind === 'homing' ? new Color(160, 140, 255) : new Color(255, 225, 110);
      const node = marker(sword, 'sword', 9, color);
      if (sword.size) {
        node.setScale(1, 1, 1);
        const g = node.getComponent(Graphics)!; g.clear();
        g.fillColor = color;
        g.rect(-sword.size.y * PIXELS_PER_UNIT / 2, -sword.size.x * PIXELS_PER_UNIT / 2, sword.size.y * PIXELS_PER_UNIT, sword.size.x * PIXELS_PER_UNIT); g.fill();
      } else node.setScale(2, 0.45, 1);
      node.angle = Math.atan2(sword.direction.y, sword.direction.x) * 180 / Math.PI;
    }
    marker(state.hero, 'hero', 22.4, new Color(90, 185, 255));
    for (const [key, node] of this.markers) if (!live.has(key)) { node.removeFromParent(); node.destroy(); this.markers.delete(key); }
    const stats = state.effects?.stats;
    const detail = stats ? `攻击${stats.attackDamage.toFixed(1)} 间隔${stats.attackIntervalSeconds.toFixed(2)}秒 暴击${(stats.critChance * 100).toFixed(0)}% 穿透${stats.pierceCount}` : '原第二阶段战斗';
    this.hudLabel!.fontSize = 20; this.hudLabel!.lineHeight = 25;
    this.hudLabel!.node.getComponent(UITransform)!.setContentSize(1240, 115);
    this.hudLabel!.node.setPosition(0, 190);
    this.hudLabel!.string = `效果测试预设：${this.preset.name}（直接注入）  |  测试参数：${this.preset.options.effects ? '敌人生命200、移速1' : '基础参数'}\n${this.preset.summary}  |  ${detail}\n生命 ${state.hero.health.toFixed(1)}/${state.hero.maxHealth.toFixed(1)}    等级 ${state.level}    经验 ${state.xp}/5    击杀 ${state.kills}    ${state.elapsedSeconds.toFixed(1)}秒\n本入口暂为二级封顶；正式升级三选一在第三步接入`;
    const statusText = { idle: '待开始', running: '战斗中', paused: '已暂停', ended: '已阵亡' }[state.state];
    this.statusLabel!.string = `${statusText}${state.xpCapped ? '  |  已达到试玩等级上限' : ''}${state.state === 'ended' ? '  |  按 R 或点击“重开”' : ''}`;
    if (this.growthRun) {
      const model = presentGrowth(rainePrototypeConfig, growthCopyPrototype, this.growthRun.snapshot());
      this.hudLabel!.string = model.hud; this.statusLabel!.string = model.status;
      this.choices?.consume([], state.elapsedSeconds); this.choices?.render(model);
    }
    this.joystickKnob!.setPosition(this.controls!.movement.x * 45, this.controls!.movement.y * 45);
    this.panel?.render(state);
  }

  private clearMarkers(): void {
    for (const node of this.markers.values()) { node.removeFromParent(); node.destroy(); }
    this.markers.clear();
  }
  onDestroy(): void {
    if (this.controls) { this.controls.onRestart = null; this.controls.dispose(); }
    this.entryRevision++; this.clearMarkers(); this.choices?.clear(); this.playtest?.clear(); this.world = null; this.growthRun = null;
  }
}
