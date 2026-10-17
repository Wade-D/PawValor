import { _decorator, Component, Label, Node, Graphics, Color, UITransform, view } from 'cc';
import { rainePrototypeConfig } from '../config/raine.prototype';
import { validateGameConfig } from '../core/validate-config';
import { DemoWorld } from '../core/demo-world';
import { FixedStepDriver } from '../core/demo-fixed-step';
import { PIXELS_PER_UNIT, DemoEntitySnapshot } from '../core/demo-model';
import { DemoInput } from './DemoInput';

const { ccclass, property } = _decorator;

@ccclass('CombatDemo')
export class CombatDemo extends Component {
  @property(Node) worldRoot: Node | null = null;
  @property(Label) hudLabel: Label | null = null;
  @property(Label) statusLabel: Label | null = null;
  @property(Node) joystickBase: Node | null = null;
  @property(Node) joystickKnob: Node | null = null;
  private world: DemoWorld | null = null;
  private controls: DemoInput | null = null;
  private readonly driver = new FixedStepDriver();
  private readonly markers = new Map<string, Node>();

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
    this.world = new DemoWorld(rainePrototypeConfig);
    console.info('[CombatDemo] Configuration valid; prototype combat ready');
    this.render();
  }

  startRun(): void { if (this.world?.snapshot().state === 'idle') { this.resetTiming(); this.world.start(); this.render(); } }
  pauseRun(): void { if (this.world?.snapshot().state === 'running') { this.world.pause(); this.resetTiming(); this.render(); } }
  resumeRun(): void { if (this.world?.snapshot().state === 'paused') { this.resetTiming(); this.world.resume(); this.render(); } }
  restartRun(): void {
    if (!this.world) return;
    this.resetTiming();
    this.clearMarkers();
    this.world.reset();
    this.world.start();
    this.render();
    console.info('[CombatDemo] Restart', this.world.snapshot().hero.handle.generation);
  }

  update(dt: number): void {
    if (!this.world || !this.controls || this.world.snapshot().state !== 'running') return;
    const result = this.driver.advance(dt, step => {
      if (this.world!.snapshot().state !== 'running') return;
      for (const event of this.world!.step(step, this.controls!.movement)) {
        if (event.type !== 'enemySpawn') console.info('[CombatDemo]', event.type, event);
      }
    });
    if (result.droppedSeconds > 0) console.warn('[CombatDemo] Catch-up time dropped', result.droppedSeconds);
    if (this.world.snapshot().state === 'ended') this.resetTiming();
    this.render();
  }

  private resetTiming(): void { this.driver.reset(); this.controls?.clear(); }

  private drawCircle(node: Node, radius: number, color: Color): void {
    const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
    graphics.clear(); graphics.fillColor = color;
    graphics.circle(0, 0, radius); graphics.fill();
  }

  private render(): void {
    if (!this.world || !this.worldRoot) return;
    const state = this.world.snapshot();
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
      const node = marker(sword, 'sword', 9, new Color(255, 225, 110));
      node.setScale(2, 0.45, 1); node.angle = Math.atan2(sword.direction.y, sword.direction.x) * 180 / Math.PI;
    }
    marker(state.hero, 'hero', 22.4, new Color(90, 185, 255));
    for (const [key, node] of this.markers) if (!live.has(key)) { node.removeFromParent(); node.destroy(); this.markers.delete(key); }
    this.hudLabel!.string = `生命 ${state.hero.health}/${state.hero.maxHealth}    等级 ${state.level}    经验 ${state.xp}/5    击杀 ${state.kills}    ${state.elapsedSeconds.toFixed(1)}秒`;
    const statusText = { idle: '待开始', running: '战斗中', paused: '已暂停', ended: '已阵亡' }[state.state];
    this.statusLabel!.string = `${statusText}${state.xpCapped ? '  |  已达到试玩等级上限' : ''}${state.state === 'ended' ? '  |  按 R 或点击“重开”' : ''}`;
    this.joystickKnob!.setPosition(this.controls!.movement.x * 45, this.controls!.movement.y * 45);
  }

  private clearMarkers(): void {
    for (const node of this.markers.values()) { node.removeFromParent(); node.destroy(); }
    this.markers.clear();
  }
  onDestroy(): void {
    if (this.controls) { this.controls.onRestart = null; this.controls.dispose(); }
    this.clearMarkers(); this.world = null;
  }
}
