import { BuildableClass } from "./Base.class.js";
import CheckList from "./userEvents/checkList.js";
import Broadcast from "./userEvents/broadcast.js";

export default class User extends BuildableClass {
  id;
  #textHandlerList = {};
  #menuReady = false;
  constructor(userData = {}) {
    super(...arguments);
    this.id = userData.id;
  }
  static async build({ userId, userData = {}, telegramData = {} } = {}) {
    const queryData = await DB.query(
      `
                SELECT u.id, u.data
                FROM users u
                WHERE u.id = $1
                GROUP BY u.id
            `,
      [userId]
    );
    const user = queryData.rows[0] || {};
    if (!user.id) {
      const queryResult = await DB.query(
        `
                    INSERT INTO users (id, data, telegram, last_login)
                    VALUES ($1, $2, $3, NOW()::timestamp)
                    RETURNING id
                `,
        [userId, userData, telegramData]
      );
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
      );
    }
    return new User({ ...user, createdFromBuilder: true });
  }

  async lastMsgCheck({ msgId } = {}) {
    const activeEvent = !msgId && this.lastMsg?.id;
    const oldEvent = msgId && this.lastMsg?.id !== msgId;
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
    const sorryText = `У нас тут что-то сломалось, но программисты уже все чинят. Попробуй обновить меня командой /start и попробовать все заново.\n`;
    const errText = `\nError message: '${err?.message}'.`;

    await BOT.sendMessage(
      this.simpleMsgWrapper.call(this, {
        text: sorryText + errText,
        entities: [
          { type: "spoiler", offset: sorryText.length, length: errText.length },
        ],
      })
    );
  }
  simpleMsgWrapper({ ...options } = {}) {
    return {
      userId: this.id,
      chatId: this.currentChat,
      ...options,
    };
  }

  startMenuMarkup() {
    return [];
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

  async startMsg() {
    await BOT.sendMessage(
      this.simpleMsgWrapper.call(this, {
        text:
          `Привет, друг! Ты общаешься с этим чат-ботом, так как мы хотим видеть тебя в наш "второй день" свадьбы.\n` +
          `Отмечать будем в неформальной обстановке 13 июня на базе отдыха "Мария", г.Энгельс. Начнем в 13-00.`,
        inlineKeyboard: [
          [
            {
              text: "Показать на карте",
              callback_data: ["getAddress", "forceActionCall"].join("__"),
            },
          ],
        ],
      })
    );
    //this.menuReady(true); // оставил тут на случай, если меню появится

    const checkList = await CheckList.build({ parent: this });
    const saveAnswerCB = checkList.saveAnswerCB;
    const inlineKeyboards = {
      alcohol: [
        [
          saveAnswerCB({ text: "Вино/шампанское", code: "soft" }),
          saveAnswerCB({ text: "Пиво", code: "beer" }),
          saveAnswerCB({ text: "Крепкие напитки", code: "hard" }),
        ],
        [
          saveAnswerCB({ text: "Никакой", code: "-" }),
          saveAnswerCB(
            { text: "Свой вариант", code: "custom" },
            "customAnswer"
          ),
        ],
      ],
      food: [
        [
          saveAnswerCB({ text: "Мясо", code: "meat" }),
          saveAnswerCB({ text: "Курица", code: "chicken" }),
          saveAnswerCB({ text: "Овощи", code: "veg" }),
        ],
      ],
      dessert: [
        [
          saveAnswerCB({ text: "Обязательно", code: "+" }),
          saveAnswerCB({ text: "Нет, спасибо", code: "-" }),
        ],
      ],
      activity: function ({ companion } = {}) {
        const who = companion ? "Он/она" : "Я";
        return [
          [saveAnswerCB({ text: `${who} за любой спорт`, code: "sport" })],
          [
            saveAnswerCB({
              text: `${who} ${companion ? "хочет" : "хочу"} петь/танцевать`,
              code: "dance",
            }),
          ],
          [
            saveAnswerCB({
              text: "Давайте просто бухать и загорать",
              code: "rest",
            }),
          ],
          [
            saveAnswerCB(
              { text: "Сохранить ответы", code: "save" },
              "saveAnswer"
            ),
          ],
        ];
      },
    };
    const hasNoCompanionCheck = function () {
      return !this.hasCompanion;
    };
    checkList.setSteps([
      {
        code: "hello",
        text: "Пожалуйста, ответь на несколько вопросов (займет пару минут):",
        inlineKeyboard: [
          [
            saveAnswerCB({
              text: "Показать вопросы",
              code: "checkListNextStep",
            }),
          ],
        ],
      },
      {
        code: "presence",
        text: "Сможешь ли ты присутствовать?",
        inlineKeyboard: [
          [
            saveAnswerCB({ text: "Да, конечно буду", code: "+" }),
            saveAnswerCB({ text: "Нет, к сожалению", code: "-" }, "endCheck"),
          ],
        ],
      },
      {
        code: "companion",
        text: "Будешь ли ты один/одна?",
        inlineKeyboard: [
          [
            saveAnswerCB({ text: "Один/одна", code: "1" }),
            saveAnswerCB({ text: "Один/одна с детьми", code: "1+" }),
          ],
          [
            saveAnswerCB({
              text: "Вдвоем",
              code: "2",
              pickAction: function () {
                this.hasCompanion = true;
              },
            }),
            saveAnswerCB({
              text: "Вдвоем с детьми",
              code: "2+",
              pickAction: function () {
                this.hasCompanion = true;
              },
            }),
          ],
        ],
      },
      {
        code: "alcohol",
        text: "Какой употребляешь алкоголь?",
        inlineKeyboard: inlineKeyboards.alcohol,
      },
      {
        code: "alcohol2",
        text: "Какой алкоголь предпочитает спутник/спутница?",
        inlineKeyboard: inlineKeyboards.alcohol,
        skipCheck: hasNoCompanionCheck,
      },
      {
        code: "food",
        text: "Закуски из?",
        inlineKeyboard: inlineKeyboards.food,
      },
      {
        code: "food2",
        text: "Какие блюда предпочитает спутник/спутница?",
        inlineKeyboard: inlineKeyboards.food,
        skipCheck: hasNoCompanionCheck,
      },
      {
        code: "dessert",
        text: "А как на счёт десертов?",
        inlineKeyboard: inlineKeyboards.dessert,
      },
      {
        code: "dessert2",
        text: "А у спутника/спутницы?",
        inlineKeyboard: inlineKeyboards.dessert,
        skipCheck: hasNoCompanionCheck,
      },
      {
        code: "transfer",
        text: "Доберешься сам или нужен трансфер?",
        inlineKeyboard: [
          [
            saveAnswerCB({
              text: "Сам",
              code: "myself",
              pickAction: function () {
                this.hasCar = true;
              },
            }),
            saveAnswerCB({
              text: "Нужен трансфер",
              code: "need_transfer",
              pickAction: function () {
                this.needTransfer = true;
              },
            }),
          ],
        ],
      },
      {
        code: "transfer_taxi",
        text: "Сколько человек можешь взять с собой?",
        skipCheck: function () {
          return !this.hasCar;
        },
        inlineKeyboard: [
          [
            saveAnswerCB({ text: "0", code: "0" }),
            saveAnswerCB({ text: "1", code: "1" }),
            saveAnswerCB({ text: "2", code: "2" }),
            saveAnswerCB({ text: "3", code: "3" }),
            saveAnswerCB({ text: "4", code: "4" }),
          ],
        ],
      },
      {
        code: "transfer_type",
        text: "Нужен трансфер туда и обратно?",
        skipCheck: function () {
          return !this.needTransfer;
        },
        inlineKeyboard: [
          [
            saveAnswerCB({ text: "Туда и обратно", code: "<->" }),
            saveAnswerCB({ text: "Только туда", code: "->" }),
            saveAnswerCB({ text: "Только обратно", code: "<-" }),
          ],
        ],
      },
      {
        code: "overnight",
        text: "Есть ли необходимость остаться на базе отдыха на ночлег?",
        inlineKeyboard: [
          [
            saveAnswerCB({ text: "Да", code: "+" }),
            saveAnswerCB({ text: "Нет", code: "-" }),
            saveAnswerCB({ text: "Как пойдет", code: "?" }),
          ],
        ],
      },
      {
        code: "activity",
        multy: true,
        text: "Готов ли ты участвовать в каких то активно-спортивных движухах или предпочитаешь релаксировать на отдыхе? (можно выбрать несколько вариантов)",
        inlineKeyboard: inlineKeyboards.activity(),
      },
      {
        code: "activity1",
        multy: true,
        text: "А какой отдых предпочитает твой спутник/спутница? (можно выбрать несколько вариантов)",
        skipCheck: hasNoCompanionCheck,
        inlineKeyboard: inlineKeyboards.activity({ companion: true }),
      },
    ]);
    this.currentAction = checkList;
    this.currentAction.start();
  }
  async getAddress() {
    const place = {
      title: "Резиденция Мария",
      address: "база отдыха Сазанка, 2, Энгельс, Саратовская область",
      latitude: 51.475479,
      longitude: 46.049778,
    };
    await BOT.sendVenue({
      userId: this.id,
      chatId: this.currentChat,
      ...place,
    });
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
  async sendSimpleAnswer({ text }) {
    const inlineKeyboard = [];
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
