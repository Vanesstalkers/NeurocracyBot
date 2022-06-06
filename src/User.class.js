import { BuildableClass } from "./Base.class.js";
import Broadcast from "./userEvents/broadcast.js";
import Question from "./userEvents/question.js";

export default class User extends BuildableClass {
  id;
  #textHandlerList = {};
  #menuReady = false;
  constructor(userData = {}) {
    super(...arguments);
    this.id = userData.id;
  }
  static async build({
    userId,
    chatId,
    userData = {},
    telegramData = {},
  } = {}) {
    const errorHandler = async function (err) {
      User.sendSystemErrorMsg({ err, userId, chatId });
      throw new Error(err);
    };

    const queryData = await DB.query(
      `
                SELECT u.id, u.data
                FROM users u
                WHERE u.id = $1
                GROUP BY u.id
            `,
      [userId]
    ).catch(errorHandler);
    const user = queryData.rows[0] || {};
    if (!user.id) {
      const queryResult = await DB.query(
        `
                    INSERT INTO users (id, data, telegram, last_login)
                    VALUES ($1, $2, $3, NOW()::timestamp)
                    RETURNING id
                `,
        [userId, userData, telegramData]
      ).catch(errorHandler);
      user.id = queryResult.rows[0].id;
      user.data = userData;
    } else {
      await DB.query(
        `
                    UPDATE users
                    SET telegram = $1, last_login = NOW()::timestamp
                    WHERE id = $2
                `,
        [telegramData, userId]
      ).catch(errorHandler);
    }
    return new User({ ...user, createdFromBuilder: true });
  }

  async lastMsgCheck({ msgId } = {}) {
    const activeEvent = !msgId && this.lastMsg?.id;
    const oldEvent =
      msgId &&
      this.lastMsg?.id !== msgId &&
      msgId !== this.lastMsg?.confirmMsgId;

    if (activeEvent || oldEvent) {
      await this.sendSimpleError({
        error:
          this.lastMsg?.lastMsgCheckErrorText ||
          (oldEvent
            ? "Эта задача уже не актуальна"
            : "Последнее действие должно быть завершено"),
      });
      return false;
    } else {
      return true;
    }
  }
  resetCurrentAction() {
    delete this.lastMsg;
    delete this.currentAction;
  }
  async sendSystemErrorMsg({ err } = {}) {
    User.sendSystemErrorMsg({ err, userId: this.id, chatId: this.currentChat });
  }
  static async sendSystemErrorMsg({ err, userId, chatId } = {}) {
    const sorryText = `У нас тут что-то сломалось, но программисты уже все чинят. Можете обновить меня командой /start и попробовать все заново.`;
    const errText = `Error message: '${err?.message}'.`;

    await BOT.sendMessage(
      this.simpleMsgWrapper({
        userId,
        chatId,
        text: sorryText + " " + errText,
        entities: [
          { type: "spoiler", offset: sorryText.length, length: errText.length },
        ],
      })
    );
  }
  simpleMsgWrapper({ ...options } = {}) {
    return User.simpleMsgWrapper({
      userId: this.id,
      chatId: this.currentChat,
      ...options,
    });
  }
  static simpleMsgWrapper({ userId, chatId, ...options } = {}) {
    return {
      userId: userId || this.id,
      chatId: chatId || this.currentChat,
      ...options,
    };
  }

  startMenuMarkup() {
    return [
      [
        this.menuItem({
          text: "🏆 Вопрос",
          actionHandler: async function () {
            await this.newQuestionEvent();
          },
        }),
        this.menuItem({
          text: "🏆 Оценка",
          actionHandler: async function () {
            console.log("🏆 Оценка");
          },
        }),
      ],
      [
        this.menuItem({
          text: "🎓 Навыки",
          web_app: {
            url: `${CONFIG.webapp.url}/?user_id=${this.id}&action=skillList`,
          },
        }),
        this.menuItem({
          text: this.alertCount > 0 ? `🔔 (${this.alertCount})` : "🔕",
          web_app: {
            url: `${CONFIG.webapp.url}/?user_id=${this.id}&action=alertList`,
          },
        }),
        this.menuItem({
          text: "🛠️ Меню",
          actionHandler: async function () {
            console.log("🛠️ Меню");
          },
        }),
      ],
    ];
  }
  menuItem(item) {
    if (item.actionHandler)
      this.#textHandlerList[item.text] = item.actionHandler;
    return { ...item, actionHandler: undefined };
  }
  menuReady(value) {
    if (value !== undefined) {
      this.#menuReady = value;
    } else {
      return this.#menuReady;
    }
  }
  getMenuHandler(handler) {
    return this.#textHandlerList[handler];
  }
  async handleMenuAction(handler) {
    if (!this.menuReady()) {
      this.startMenuMarkup.call(this);
      this.menuReady(true);
    }
    const menuHandler = this.getMenuHandler(handler);
    if (menuHandler) {
      return await menuHandler.call(this);
    } else {
      return false;
    }
  }

  async startMsg({ msg } = {}) {
    await BOT.sendMessage(
      this.simpleMsgWrapper({
        text: `Приветствую! У вас есть меню.`,
        keyboard: this.startMenuMarkup.call(this),
      })
    );
    this.menuReady(true);
    await BOT.sendMessage(
      this.simpleMsgWrapper({
        text: `У вас есть вопросы?`,
        inlineKeyboard: [
          [{ text: "Вопросов нет, давай начинать!", callback_data: "hello" }],
        ],
      })
    );
  }

  async newQuestionEvent() {
    if (await this.lastMsgCheck()) {
      this.resetCurrentAction();
      this.currentAction = await Question.build({ parent: this });
    }
  }
  async newRateEvent() {
    if (await this.lastMsgCheck()) {
      this.resetCurrentAction();
      // this.currentAction = await Rate.build({ parent: this });
    }
  }

  async help() {
    if (!this.currentAction) {
      await this.sendSimpleAnswer({
        text: "Выберите одно из действий, которые можно совершить.",
      });
    } else {
      this.currentAction?.help();
    }
  }
  async sendSimpleAnswer({ text, btnQ = true, btnA = true }) {
    const inlineKeyboard = [];
    if (btnQ)
      inlineKeyboard.push([
        {
          text: "Задать новый вопрос",
          callback_data: "newQuestionEvent",
        },
      ]);
    if (btnA)
      inlineKeyboard.push([
        {
          text: "Оценить чужой вопрос",
          callback_data: "newRateEvent",
        },
      ]);
    await BOT.sendMessage({
      chatId: this.currentChat,
      text,
      inlineKeyboard,
    });
  }
  async sendSimpleError({ error }) {
    await BOT.sendMessage({
      chatId: this.currentChat,
      text:
        "<b>Ошибка</b>: " +
        error +
        (this.lastMsg?.id
          ? "\n<i>Актуальная задача прикреплена к данному сообщению.</i>"
          : ""),
      replyId: this.lastMsg?.id,
    });
  }

  async newBroadcast() {
    // if (await this.lastMsgCheck()) {
    //   this.resetCurrentAction();
      this.currentAction = await Broadcast.build({ parent: this });
      this.currentAction.start();
    // }
  }
}
