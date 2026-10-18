import { _decorator, BlockInputEvents, Button, Color, Component, EventTouch, Graphics, Label, Node, UITransform } from 'cc';
import type { GrowthEvent, GrowthToken } from '../core/growth-model';
import type { GrowthViewModel } from '../core/growth-presentation';
const { ccclass } = _decorator;
export function uiLabel(parent: Node, text: string, width: number, height: number, fontSize: number): Node {
  const node = new Node('中文说明'); node.layer = parent.layer; parent.addChild(node);
  node.addComponent(UITransform).setContentSize(width, height);
  const label = node.addComponent(Label); label.string = text; label.fontSize = fontSize; label.lineHeight = fontSize + 5;
  label.color = new Color(240, 246, 255); label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER; label.overflow = Label.Overflow.SHRINK; label.enableWrapText = true;
  return node;
}
export function uiButton(parent: Node, text: string, width: number, height: number, callback: () => void): Node {
  const node = new Node(text); node.layer = parent.layer; parent.addChild(node);
  node.addComponent(UITransform).setContentSize(width, height);
  const g = node.addComponent(Graphics); g.fillColor = new Color(30, 75, 100, 255);
  g.roundRect(-width / 2, -height / 2, width, height, 8); g.fill();
  uiLabel(node, text, width - 12, height - 4, 21);
  node.addComponent(Button); node.addComponent(BlockInputEvents);
  node.on(Node.EventType.TOUCH_END, (event: EventTouch) => { event.propagationStopped = true; callback(); });
  return node;
}
function remove(node: Node | null): void { if (node) { node.removeFromParent(); node.destroy(); } }
interface Handlers { select: (token: GrowthToken, id: string) => void; reroll: (token: GrowthToken) => void; restart: () => void; retry: () => void }
@ccclass('GrowthChoicePanel')
export class GrowthChoicePanel extends Component {
  private root: Node | null = null;
  private modal: Node | null = null;
  private detail: Node | null = null;
  private notice: Node | null = null;
  private handlers: Handlers | null = null;
  private signature = '';
  private detailsVisible = false;
  private readonly notices: { text: string; end: number }[] = [];
  initialize(parent: Node, handlers: Handlers): void {
    this.handlers = handlers;
    this.root = new Node('成长界面'); this.root.layer = parent.layer; parent.addChild(this.root);
    uiButton(this.root, '构筑详情', 150, 38, () => { this.detailsVisible = !this.detailsVisible; if (this.detail) this.detail.active = this.detailsVisible; }).setPosition(-540, 110);
    this.detail = new Node('构筑详情'); this.detail.layer = parent.layer; this.root.addChild(this.detail); this.detail.setPosition(-370, -90);
    this.detail.addComponent(UITransform).setContentSize(470, 390);
    const g = this.detail.addComponent(Graphics); g.fillColor = new Color(12, 25, 40, 245); g.roundRect(-235, -195, 470, 390, 8); g.fill();
    this.detail.addComponent(BlockInputEvents); uiLabel(this.detail, '', 450, 370, 17); this.detail.active = false;
    this.notice = uiLabel(this.root, '', 1040, 70, 20); this.notice.setPosition(40, 90);
  }
  render(view: GrowthViewModel): void {
    if (!this.root || !this.handlers) return; this.root.active = true;
    this.detail!.children[0].getComponent(Label)!.string = view.buildLines.join('\n');
    const signature = JSON.stringify([view.title, view.cards, view.token, view.refresh, view.activatingLines, view.error]);
    if (signature === this.signature) return; this.signature = signature; remove(this.modal); this.modal = null;
    if (!view.cards.length && !view.error) return;
    const modal = this.modal = new Node('成长选择遮罩'); modal.layer = this.root.layer; this.root.addChild(modal);
    modal.addComponent(UITransform).setContentSize(1280, 720); modal.addComponent(BlockInputEvents);
    const g = modal.addComponent(Graphics); g.fillColor = new Color(7, 15, 28, 245); g.rect(-640, -360, 1280, 720); g.fill();
    uiLabel(modal, view.title, 1100, 55, 30).setPosition(0, 250);
    uiLabel(modal, view.error ?? view.activatingLines.join('\n'), 1100, 65, 21).setPosition(0, 190);
    const token = view.token ? { ...view.token } : null;
    view.cards.forEach((card, index) => {
      const node = uiButton(modal, '', 320, 300, () => { if (token && !view.error) this.handlers?.select(token, card.optionId); });
      node.setPosition((index - (view.cards.length - 1) / 2) * 350, -20);
      uiLabel(node, card.category, 290, 30, 18).setPosition(0, 120);
      uiLabel(node, card.name, 290, 50, 27).setPosition(0, 75);
      uiLabel(node, card.rankText, 290, 35, 18).setPosition(0, 28);
      uiLabel(node, card.description, 285, 140, 20).setPosition(0, -65);
      node.getComponent(Button)!.interactable = !view.error;
    });
    if (view.refresh.visible) {
      const node = uiButton(modal, view.refresh.label, 220, 45, () => { if (token && view.refresh.enabled) this.handlers?.reroll(token); });
      node.setPosition(-130, -230); node.getComponent(Button)!.interactable = view.refresh.enabled;
    }
    uiButton(modal, '重开本局', 170, 45, () => this.handlers?.restart()).setPosition(120, -230);
    if (view.error) uiButton(modal, '重试成长', 180, 45, () => this.handlers?.retry()).setPosition(330, -230);
    uiLabel(modal, '选择期间战斗冻结；主路线与分支选定后本局锁定', 1050, 35, 18).setPosition(0, -290);
  }
  consume(events: readonly GrowthEvent[], elapsedSeconds: number): void {
    for (const event of events) this.notices.push({ text: event.type === 'synergyActivated' ? `${event.name}已免费激活！` : '终极进化已记录，招式效果在第四阶段实现', end: elapsedSeconds + 3 });
    for (let i = this.notices.length - 1; i >= 0; i--) if (this.notices[i].end <= elapsedSeconds) this.notices.splice(i, 1);
    if (this.notice) this.notice.getComponent(Label)!.string = this.notices.map(item => item.text).join('\n');
  }
  clear(): void {
    remove(this.modal); this.modal = null; this.signature = ''; this.notices.length = 0; this.detailsVisible = false;
    if (this.notice) this.notice.getComponent(Label)!.string = ''; if (this.detail) this.detail.active = false; if (this.root) this.root.active = false;
  }
  onDestroy(): void { this.clear(); this.handlers = null; remove(this.root); this.root = null; }
}
