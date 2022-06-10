export default {};

export class BuildableClass {
  constructor(data = {}) {
    if (!data.createdFromBuilder)
      throw new Error("Creation of this class is allowed ONLY with builder.");
  }
}

export class Event extends BuildableClass {
  #parent = null;
  #errorIdx = 0;
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
  stringifyError({ error }) {
    // избавляет от ошибки "message is not modified" + визуализирует для полльзователя, что ошибка осталась
    return (
      (this.#errorIdx++ % 2 > 0 ? "❗❗❗" : "‼️‼️‼️") +
      " <b>Ошибка</b>: " +
      error
    );
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
