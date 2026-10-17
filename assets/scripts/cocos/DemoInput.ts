import { _decorator, Component, EventKeyboard, EventTouch, game, Game, input, Input, KeyCode, Vec2, view } from 'cc';

const { ccclass } = _decorator;

/** Input intent only. CombatDemo owns simulation, pause state, and restart. */
@ccclass('DemoInput')
export class DemoInput extends Component {
  readonly movement = new Vec2();
  onRestart: (() => void) | null = null;
  private readonly keys = new Set<KeyCode>();
  private touchId: number | null = null;
  private readonly touchOrigin = new Vec2();
  private listening = false;

  onEnable(): void {
    if (this.listening) return;
    this.listening = true;
    input.on(Input.EventType.KEY_DOWN, this.keyDown, this);
    input.on(Input.EventType.KEY_UP, this.keyUp, this);
    input.on(Input.EventType.TOUCH_START, this.touchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.touchMove, this);
    input.on(Input.EventType.TOUCH_END, this.touchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.touchCancel, this);
    game.on(Game.EVENT_HIDE, this.clear, this);
    if (typeof window !== 'undefined') window.addEventListener('blur', this.blur);
  }

  onDisable(): void { this.dispose(); }
  onDestroy(): void { this.dispose(); this.onRestart = null; }

  clear(): void {
    this.keys.clear();
    this.touchId = null;
    this.movement.set(0, 0);
  }

  dispose(): void {
    this.clear();
    if (!this.listening) return;
    this.listening = false;
    input.off(Input.EventType.KEY_DOWN, this.keyDown, this);
    input.off(Input.EventType.KEY_UP, this.keyUp, this);
    input.off(Input.EventType.TOUCH_START, this.touchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.touchMove, this);
    input.off(Input.EventType.TOUCH_END, this.touchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.touchCancel, this);
    game.off(Game.EVENT_HIDE, this.clear, this);
    if (typeof window !== 'undefined') window.removeEventListener('blur', this.blur);
  }

  private readonly blur = (): void => this.clear();

  private keyDown(event: EventKeyboard): void {
    const wasDown = this.keys.has(event.keyCode);
    this.keys.add(event.keyCode);
    if (event.keyCode === KeyCode.KEY_R && !wasDown) this.onRestart?.();
    this.keyboardMovement();
  }

  private keyUp(event: EventKeyboard): void {
    this.keys.delete(event.keyCode);
    this.keyboardMovement();
  }

  private keyboardMovement(): void {
    if (this.touchId !== null) return;
    const held = (a: KeyCode, b: KeyCode): number => Number(this.keys.has(a) || this.keys.has(b));
    this.movement.set(held(KeyCode.KEY_D, KeyCode.ARROW_RIGHT) - held(KeyCode.KEY_A, KeyCode.ARROW_LEFT),
      held(KeyCode.KEY_W, KeyCode.ARROW_UP) - held(KeyCode.KEY_S, KeyCode.ARROW_DOWN));
    if (this.movement.lengthSqr() > 1) this.movement.normalize();
  }

  private touchStart(event: EventTouch): void {
    if (this.touchId !== null) return;
    const point = event.getUILocation();
    const size = view.getVisibleSize();
    const origin = view.getVisibleOrigin();
    if (point.x > origin.x + size.width / 2 || point.y > origin.y + size.height / 2) return;
    this.touchId = event.getID();
    this.touchOrigin.set(point);
    this.movement.set(0, 0);
  }

  private touchMove(event: EventTouch): void {
    if (event.getID() !== this.touchId) return;
    const point = event.getUILocation();
    this.movement.set((point.x - this.touchOrigin.x) / 80, (point.y - this.touchOrigin.y) / 80);
    if (this.movement.lengthSqr() > 1) this.movement.normalize();
  }

  private touchEnd(event: EventTouch): void {
    if (event.getID() !== this.touchId) return;
    this.touchId = null;
    this.keyboardMovement();
  }

  private touchCancel(event: EventTouch): void {
    if (event.getID() === this.touchId) this.clear();
  }
}
