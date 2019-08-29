import { BehaviorSubject } from 'rxjs';
import { BasicModel, isModel } from './basic';
import { ValidateOption } from '../validate';
import { ModelRef, isModelRef } from './ref';
import { BasicBuilder } from '../builders/basic';

type FieldArrayChild<Item, Child extends BasicModel<Item>> =
  | Child
  | ModelRef<Item, FieldArrayModel<Item, Child>, Child>;

class FieldArrayModel<Item, Child extends BasicModel<Item> = BasicModel<Item>> extends BasicModel<readonly Item[]> {
  /**
   * @internal
   */
  isFieldArrayModel!: boolean;

  readonly children$: BehaviorSubject<FieldArrayChild<Item, Child>[]>;

  private readonly childFactory: (defaultValue: Item) => FieldArrayChild<Item, Child>;

  /** @internal */
  constructor(childBuilder: BasicBuilder<Item, Child> | null, private readonly defaultValue: readonly Item[]) {
    super();
    this.childFactory = childBuilder
      ? (defaultValue: Item) => childBuilder.build(defaultValue)
      : (defaultValue: Item) =>
          new ModelRef<Item, FieldArrayModel<Item, Child>, Child>(undefined, defaultValue, {
            owner: this,
          });
    const children = this.defaultValue.map(this.childFactory);
    this.children$ = new BehaviorSubject(children);
  }

  reset() {
    const children = (this.initialValue || this.defaultValue).map(this.childFactory);
    this.children$.next(children);
  }

  clear() {
    this.initialValue = undefined;
    const children = this.defaultValue.map(this.childFactory);
    this.children$.next(children);
  }

  get children() {
    return this.children$.getValue();
  }

  valid() {
    if (this.error$.getValue() !== null) {
      return false;
    }
    const children = this.children$.getValue();
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      if (isModelRef(child)) {
        const model = child.getModel();
        if (!model || !model.valid()) {
          return false;
        }
      } else if (isModel(child) && !child.valid()) {
        return false;
      }
    }
    return true;
  }

  getRawValue(): (Item | null)[] {
    return this.children$.getValue().map(child => {
      if (isModelRef<Item, this, Child>(child)) {
        const model = child.getModel();
        return model ? model.getRawValue() : null;
      } else if (isModel<Item>(child)) {
        return child.getRawValue();
      }
      return null;
    });
  }

  patchValue(value: Item[]) {
    const children = this.children$.getValue();
    for (let i = 0; i < value.length; i += 1) {
      if (i >= children.length) {
        break;
      }
      const item = value[i];
      const model = children[i];
      if (isModelRef(model)) {
        const m = model.getModel();
        m && m.patchValue(item);
      } else if (isModel(model)) {
        model.patchValue(item);
      }
    }
    if (value.length <= children.length) {
      this.splice(value.length, children.length - value.length);
      return;
    }
    for (let i = children.length; i < value.length; i += 1) {
      const item = value[i];
      this.push(item);
    }
  }

  initialize(values: Item[]) {
    this.initialValue = values;
    this.children$.next(values.map(this.childFactory));
  }

  push(...items: Item[]) {
    const nextChildren: FieldArrayChild<Item, Child>[] = this.children$.getValue().concat(items.map(this.childFactory));
    this.children$.next(nextChildren);
  }

  pop() {
    const children = this.children$.getValue().slice();
    const child = children.pop();
    this.children$.next(children);
    return child;
  }

  shift() {
    const children = this.children$.getValue().slice();
    const child = children.shift();
    this.children$.next(children);
    return child;
  }

  unshift(...items: Item[]) {
    const nextChildren = items.map(this.childFactory).concat(this.children$.getValue());
    this.children$.next(nextChildren);
  }

  splice(start: number, deleteCount: number = 0, ...items: readonly Item[]): FieldArrayChild<Item, Child>[] {
    const children = this.children$.getValue().slice();
    const ret = children.splice(start, deleteCount, ...items.map(this.childFactory));
    this.children$.next(children);
    return ret;
  }

  validate(option = ValidateOption.Default) {
    this.validate$.next(option);
    if (option & ValidateOption.IncludeChildren) {
      const children = this.children$.getValue();
      const childOption = option | ValidateOption.FromParent;
      for (let i = 0; i < children.length; i += 1) {
        const child = children[i];
        child.validate(childOption);
      }
    }
  }

  pristine() {
    const children = this.children$.getValue();
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      if (child.dirty()) {
        return false;
      }
    }
    return true;
  }

  dirty() {
    return !this.pristine();
  }

  touched() {
    const children = this.children$.getValue();
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      if (child.touched()) {
        return true;
      }
    }
    return false;
  }
}

FieldArrayModel.prototype.isFieldArrayModel = true;

function isFieldArrayModel<Item, Child extends BasicModel<Item> = BasicModel<Item>>(
  maybeModel: any,
): maybeModel is FieldArrayModel<Item, Child> {
  if (!maybeModel) {
    return false;
  }
  return !!maybeModel.isFieldArrayModel;
}

export { FieldArrayChild, FieldArrayModel, isFieldArrayModel };