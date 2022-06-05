export default {};

export class BuildableClass {
  constructor(data = {}) {
    if (!data.createdFromBuilder)
      throw new Error("Creation of this class is allowed ONLY with builder.");
  }
}

export class Event extends BuildableClass {
  #parent = null;
  constructor({ parent }) {
    super(...arguments);
    this.#parent = parent;
  }
  static async build() {
    return new Event();
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
