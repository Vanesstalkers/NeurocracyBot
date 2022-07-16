/**
 * @typedef {import('./Base.class.js').constructData} constructData
 */
/**
 * @typedef eventBuildData
 * @property {User} parent - jsdoc parent (build).
 * @property {customMode} [customMode] - jsdoc customMode (build).
 */
/**
 * @typedef customMode
 * @property {string} [mode] - jsdoc mode
 * @property {string[]} skillList - jsdoc skillList.
 * @property {number} [questionRate] - jsdoc questionRate.
 */

import { BuildableClass } from "./Base.class.js";
import User from "./User.class.js";

/**
 * Базовый класс для всех событий пользователя
 * @extends BuildableClass
 */
class Event extends BuildableClass {
  /** @type {number} */
  #errorIdx = 0;
  /** @param {constructData} data */
  constructor(data) {
    super(data);
    if(!(data.parent instanceof User)) throw new Error("parent must be instance of User");
  }
  /** @param {eventBuildData} data */
  static async build(data) {
    return new Event({ ...data, createdFromBuilder: true });
  }
  /** @param {{error: string}} data */
  stringifyError({ error }) {
    return (
      (this.#errorIdx++ % 2 > 0 ? "❗❗❗" : "‼️‼️‼️") +
      " <b>Ошибка</b>: " +
      error
    );
  }
  /** @returns {User} */
  getParent() {
    const parent = super.getParent();
    if(!(parent instanceof User)) throw new Error("parent user not found");
    return parent;
  }
}
export default Event;