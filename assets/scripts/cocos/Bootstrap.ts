import { _decorator, Component, Label } from 'cc';
import { rainePrototypeConfig } from '../config/raine.prototype';
import { validateGameConfig } from '../core/validate-config';

const { ccclass, property } = _decorator;

/** Phase 1 startup diagnostics only; configuration validation does not start combat. */
@ccclass('Bootstrap')
export class Bootstrap extends Component {
  @property(Label)
  statusLabel: Label | null = null;

  onLoad(): void {
    const issues = validateGameConfig(rainePrototypeConfig);
    const message = issues.length === 0
      ? 'Pawvalor：配置校验通过（测试参数）'
      : `Pawvalor：配置校验失败（${issues.length} 个错误）`;

    if (this.statusLabel) {
      this.statusLabel.string = message;
    } else {
      console.error('[Pawvalor] Bootstrap.statusLabel 未绑定');
    }

    if (issues.length > 0) {
      console.error('[Pawvalor] 配置校验失败', issues);
      return;
    }

    console.info(message);
  }
}
