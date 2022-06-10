import { Event } from "../Base.class.js";
import { toCBD } from "../Lobby.class.js";

export default class Table extends Event {
  itemList = [];
  pagination = { page: 0, count: 4 };
  constructor() {
    super(...arguments);
  }
  static async build({ parent: user } = {}) {
    return new Table({ parent: user, createdFromBuilder: true });
  }
  async start() {
    const { offset, count } = this.updatePagination();
    for (const [code, data] of [...this.baseEntries].splice(offset, count)) {
      const msg = await BOT.sendMessage(this.createItemMsg({ code }));
      this.itemList.push({
        code: code,
        label: data.label,
        msgId: msg.message_id,
      });
    }
    await BOT.sendMessage(this.createPaginationMsg(), {
      childMsgIdList: this.itemList.map((item) => item.msgId),
    });
  }
  setSimpleMsgWrapper(wrapper) {
    this.simpleMsgWrapper = wrapper;
  }
  setLST(lst) {
    this.baseLST = lst;
    this.baseEntries = Object.entries(lst);
  }
  setItemKeyboardBuilder(action) {
    this.itemKeyboardBuilder = action;
  }
  setPaginationMsgTextBuilder(action) {
    this.paginationMsgTextBuilder = action;
  }
  setHandler(handler, action) {
    if (!this[handler]) {
      this[handler] = action;
    } else {
      throw new Error("handler exist");
    }
  }
  updatePagination() {
    const offset = this.pagination.page * this.pagination.count;
    const count = this.pagination.count;
    const prev = this.baseEntries[offset - 1];
    const next = this.baseEntries[offset + count + 1 - 1];
    this.pagination.btnLeft = !prev ? "-" : "<< " + prev[1].label;
    this.pagination.btnRight = !next ? "-" : next[1].label + " >>";
    return { offset, count };
  }
  createItemMsg({ msgId, code, customAttributes }) {
    const item =
      this.itemList.find((item) => item.msgId === msgId) || this.baseLST[code];
    let text = `${item.label}`;
    if (item.showInfo) text += `\nℹ️ <i>${this.baseLST[code].info}</i>`;

    return this.simpleMsgWrapper({
      msgId,
      text,
      inlineKeyboard: this.createItemMsgKeyboard({ code, customAttributes }),
    });
  }
  createItemMsgKeyboard({ code, customAttributes }) {
    const tableItem = this.itemList.find((item) => item.code === code) || {};
    return this.itemKeyboardBuilder({ code, tableItem, customAttributes });
  }
  createPaginationMsg({ msgId } = {}) {
    const nullCBD = toCBD("null");
    const minusCBD = toCBD("togglePagination", "-");
    const plusCBD = toCBD("togglePagination", "+");
    return this.simpleMsgWrapper({
      msgId,
      text: this.paginationMsgTextBuilder(),
      inlineKeyboard: [
        [
          {
            text: this.pagination.btnLeft,
            ...(this.pagination.btnLeft === "-" ? nullCBD : minusCBD),
          },
          {
            text: this.pagination.btnRight,
            ...(this.pagination.btnRight === "-" ? nullCBD : plusCBD),
          },
        ],
      ],
    });
  }
  async togglePagination({ msgId, data: [type] }) {
    this.pagination.page += type === "+" ? 1 : -1;
    const { offset, count } = this.updatePagination();
    const newItemList = [...this.baseEntries].splice(offset, count);
    for (const [idx, item] of Object.entries(this.itemList)) {
      const newItem = newItemList[idx];
      if (!newItem) {
        await BOT.editMessageText(
          this.simpleMsgWrapper({ msgId: item.msgId, text: "-" })
        );
      } else {
        const code = newItem[0];
        this.itemList[idx].code = code;
        this.itemList[idx].label = newItem[1].label;
        delete this.itemList[idx].showInfo;
        await BOT.editMessageText(
          this.createItemMsg({ msgId: item.msgId, code })
        );
      }
    }

    await BOT.editMessageText(this.createPaginationMsg({ msgId }));
  }
  async helpItem({ msgId, data: [code, toggleType] }) {
    const item = this.itemList.find((item) => item.msgId === msgId);
    item.showInfo = toggleType === "show" ? true : false;
    await BOT.editMessageText(
      this.createItemMsg({ msgId: item.msgId, code: item.code })
    );
  }
}
