import { _decorator, BlockInputEvents, Button, Color, Component, EventTouch, Graphics, Label, Node, UITransform } from 'cc';
import { combatPresetIds, CombatPresetId, createCombatPreset } from '../config/combat-presets.prototype';
import { DemoEvent, DemoSnapshot, PIXELS_PER_UNIT } from '../core/demo-model';
import { uiButton } from './GrowthChoicePanel';

const { ccclass } = _decorator;
interface Transient { node: Node; start: number; end: number; y: number; }

@ccclass('CombatEffectPanel')
export class CombatEffectPanel extends Component {
  private root: Node | null = null;
  private readonly transients: Transient[] = [];
  private readonly enemies = new Map<string, Node>();
  private readonly positions = new Map<string, { x: number; y: number }>();
  private serial = 0;
  private key(handle: { id: number; generation: number }): string { return `${handle.generation}:${handle.id}`; }

  initialize(parent: Node, onPreset: (id: CombatPresetId) => void, onGrowth?: () => void): void {
    this.root = new Node('效果测试面板'); this.root.layer = parent.layer; parent.addChild(this.root);
    combatPresetIds.forEach((id, i) => {
      const button = new Node('预设按钮'); button.layer = this.root!.layer; this.root!.addChild(button);
      button.addComponent(UITransform).setContentSize(160, 40);
      button.name = `预设-${id}`; button.setPosition(-450 + i * 180, 255);
      const g = button.addComponent(Graphics); g.fillColor = new Color(28, 67, 90, 240); g.roundRect(-80, -20, 160, 40, 7); g.fill();
      // 背景先绘制，文字单独放在其上方。
      const caption = this.label(createCombatPreset(id).name, 160, 40, 21); button.addChild(caption);
      button.addComponent(Button); button.addComponent(BlockInputEvents);
      button.on(Node.EventType.TOUCH_END, (event: EventTouch) => { event.propagationStopped = true; onPreset(id); });
    });
    if (onGrowth) uiButton(this.root, '成长试玩', 160, 40, onGrowth).setPosition(450, 255);
  }

  consume(events: readonly DemoEvent[]): void {
    for (const event of events) {
      if (event.type === 'enemySpawn') this.positions.set(this.key(event.handle), { ...event.position });
      if (event.type === 'hit') {
        const position = this.positions.get(this.key(event.target)); if (!position) continue;
        const source = { direct: '直击', split: '追踪', bounce: '弹射', explosion: '爆裂', element: '元素', 'damage-over-time': '灼烧', synergy: '组合' }[event.source.sourceKind];
        const node = this.label(`${event.effectName ?? source}${event.critical ? '暴击' : ''} ${event.damage.toFixed(1)}`, 210, 25, 18);
        const x = position.x * PIXELS_PER_UNIT, y = position.y * PIXELS_PER_UNIT + 40 + (this.serial++ % 4) * 22;
        node.setPosition(x, y); this.transients.push({ node, start: event.elapsedSeconds, end: event.elapsedSeconds + 0.8, y });
      }
      if (event.type === 'effectTriggered' && event.radius !== undefined) {
        const node = new Node('爆裂范围'); node.layer = this.root!.layer; this.root!.addChild(node);
        node.setPosition(event.position.x * PIXELS_PER_UNIT, event.position.y * PIXELS_PER_UNIT);
        const g = node.addComponent(Graphics); g.strokeColor = new Color(255, 145, 65); g.lineWidth = 3;
        g.circle(0, 0, event.radius * PIXELS_PER_UNIT); g.stroke();
        this.transients.push({ node, start: event.elapsedSeconds, end: event.elapsedSeconds + 0.3, y: node.position.y });
      }
    }
  }

  render(snapshot: DemoSnapshot): void {
    const live = new Set<string>();
    for (const enemy of snapshot.enemies) {
      const key = this.key(enemy.handle); live.add(key); this.positions.set(key, { ...enemy.position });
      let node = this.enemies.get(key);
      if (!node) { node = this.label('', 180, 48, 16); this.enemies.set(key, node); }
      node.setPosition(enemy.position.x * PIXELS_PER_UNIT, enemy.position.y * PIXELS_PER_UNIT - 43);
      const flags = (enemy.statuses ?? []).map(s => s.kind === 'burn' ? '灼烧' : '寒冷').join(' ');
      node.getComponent(Label)!.string = `生命 ${enemy.health.toFixed(1)}${enemy.maxHealth ? '/' + enemy.maxHealth : ''}\n${flags}`;
    }
    for (const [key, node] of this.enemies) if (!live.has(key)) { node.destroy(); this.enemies.delete(key); this.positions.delete(key); }
    for (let i = this.transients.length - 1; i >= 0; i--) {
      const effect = this.transients[i];
      if (snapshot.elapsedSeconds >= effect.end) { effect.node.destroy(); this.transients.splice(i, 1); }
      else if (effect.node.getComponent(Label)) effect.node.setPosition(effect.node.position.x, effect.y + (snapshot.elapsedSeconds - effect.start) * 25);
    }
  }

  clear(): void {
    for (const effect of this.transients) effect.node.destroy(); this.transients.length = 0;
    for (const node of this.enemies.values()) node.destroy(); this.enemies.clear(); this.positions.clear(); this.serial = 0;
  }
  onDestroy(): void { this.clear(); this.root?.destroy(); this.root = null; }
  private label(text: string, width: number, height: number, fontSize: number): Node {
    const node = new Node('效果文字'); node.layer = this.root!.layer; this.root!.addChild(node);
    node.addComponent(UITransform).setContentSize(width, height);
    const label = node.addComponent(Label); label.string = text; label.fontSize = fontSize; label.lineHeight = fontSize + 3;
    label.color = new Color(245, 248, 255); label.horizontalAlign = Label.HorizontalAlign.CENTER;
    return node;
  }
}
