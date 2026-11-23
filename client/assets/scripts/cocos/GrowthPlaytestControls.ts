import { _decorator, Component, Node } from 'cc';
import { uiButton, uiLabel } from './GrowthChoicePanel';
const { ccclass } = _decorator;
@ccclass('GrowthPlaytestControls')
export class GrowthPlaytestControls extends Component {
  private root: Node | null = null;
  initialize(parent: Node, handlers: { prepare: () => void; grantXp: (amount: number) => void }): void {
    this.clear(); this.root = new Node('显式成长测试入口'); this.root.layer = parent.layer; parent.addChild(this.root);
    uiLabel(this.root, '测试入口\n可注入经验\n敌人生命200\n移速0\n接触伤害0', 120, 130, 16).setPosition(575, 95);
    uiButton(this.root, '准备组合前置', 120, 42, handlers.prepare).setPosition(575, -25);
    uiButton(this.root, '经验+5', 120, 42, () => handlers.grantXp(5)).setPosition(575, -80);
    uiButton(this.root, '经验+55', 120, 42, () => handlers.grantXp(55)).setPosition(575, -135);
  }
  clear(): void { if (this.root) { this.root.removeFromParent(); this.root.destroy(); this.root = null; } }
  onDestroy(): void { this.clear(); }
}
