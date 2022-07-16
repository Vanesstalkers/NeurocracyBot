export default {};
/**
 * @typedef constructData
 * @property {?BuildableClass} parent - jsdoc parent.
 * @property {boolean} createdFromBuilder - jsdoc createdFromBuilder.
 */

/**
 * Базовый класс, элементы которого создаются через метод build()
 */
export class BuildableClass {
  /** @type {?BuildableClass} */
  #parent = null;
  /** @param {constructData} data */
  constructor(data = { createdFromBuilder: false, parent: null }) {
    const { parent } = data;
    this.#parent = parent;
    if (!data.createdFromBuilder)
      throw new Error("Creation of this class is allowed ONLY with builder.");
  }
  getParent() {
    return this.#parent;
  }
}

export class Bot extends BuildableClass {
  lastReplyMsg = { text: 1 };
  constructor() {
    super(...arguments);
  }
  static async build() {
    return new Bot({ createdFromBuilder: true });
  }
}
