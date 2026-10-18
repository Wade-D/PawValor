import { _decorator, Component, Node } from 'cc';
import { uiButton, uiLabel } from './GrowthChoicePanel';
const { ccclass } = _decorator;
@ccclass('GrowthPlaytestControls')
export class GrowthPlaytestControls extends Component {
  private root: Node | null = null;
  initialize(parent: Node, handlers: { prepare: () => void; grantXp: (amount: number) => void }): void {
    this.clear(); this.root = new Node('显式成长测试入口'); this.root.layer = parent.layer; parent.addChild(this.root);
    uiLabel(this.root, '测试入口：可注入经验；敌人生命200 / 移速0 / 接触伤害0', 660, 35, 17).setPosition(-240, -245);
    uiButton(this.root, '准备组合前置', 170, 42, handlers.prepare).setPosition(-450, -295);
    uiButton(this.root, '经验+5', 150, 42, () => handlers.grantXp(5)).setPosition(-270, -295);
    uiButton(this.root, '经验+55', 150, 42, () => handlers.grantXp(55)).setPosition(-100, -295);
  }
  clear(): void { if (this.root) { this.root.removeFromParent(); this.root.destroy(); this.root = null; } }
  onDestroy(): void { this.clear(); }
}
