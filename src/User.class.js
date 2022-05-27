import { simpleMsgWrapper, checkListMsgWrapper } from "./BotQueryHelper.js";

export default class User {
  id;
  constructor() {}
  async init({ userId, userData = {}, telegramData = {} } = {}) {
    const queryData = await process.DB.query(
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
      const queryResult = await process.DB.query(
        `
                    INSERT INTO users (id, data, telegram, last_login)
                    VALUES ($1, $2, $3, NOW()::timestamp)
                    RETURNING id
                `,
        [userId, userData, telegramData]
      );
      this.id = queryResult.rows[0].id;
      user.data = userData;
    } else {
      this.id = user.id;
      await process.DB.query(
        `
                    UPDATE users
                    SET telegram = $1, last_login = NOW()::timestamp
                    WHERE id = $2
                `,
        [telegramData, userId]
      );
    }
    return this;
  }
  resetCurrentAction() {
    delete this.lastMsgId;
    delete this.currentAction;
    delete this.checkList;
  }
  async sendSystemErrorMsg({ err } = {}) {
    const sorryText = `У нас тут что-то сломалось, но программисты уже все чинят. Попробуй обновить меня командой /start и попробовать все заново.\n`;
    const errText = `\nError message: '${err?.message}'.`;

    await process.BOT.sendMessage(
      simpleMsgWrapper.call(this, {
        text: sorryText + errText,
        entities: [
          { type: "spoiler", offset: sorryText.length, length: errText.length },
        ],
      })
    );
  }
  async startMsg() {
    function saveAnswerCB(obj, ...params) {
      obj.callback_data = ["saveAnswer", obj.code].concat(params).join("__");
      return obj;
    }
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
      activity: ({ companion } = {}) => {
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
    const hasNoCompanionCheck = () => {
      return !this.currentAction.hasCompanion;
    };

    await process.BOT.sendMessage(
      simpleMsgWrapper.call(this, {
        text:
          `Привет, друг! Ты общаешься с этим чат-ботом, так как мы хотим видеть тебя в наш "второй день" свадьбы.\n` +
          `Отмечать будем в неформальной обстановке 13 июня на базе отдыха "Мария", г.Энгельс. Начнем в 13-00.`,
        inlineKeyboard: [
          [{ text: "Показать на карте", callback_data: "getAddress" }],
        ],
      })
    );

    this.currentAction = {
      answers: {},
    };
    this.checkList = {
      currentStep: 0,
    };
    this.checkList.steps = [
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
              pickAction: () => {
                this.currentAction.hasCompanion = true;
              },
            }),
            saveAnswerCB({
              text: "Вдвоем с детьми",
              code: "2+",
              pickAction: () => {
                this.currentAction.hasCompanion = true;
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
              pickAction: () => {
                this.currentAction.hasCar = true;
              },
            }),
            saveAnswerCB({
              text: "Нужен трансфер",
              code: "need_transfer",
              pickAction: () => {
                this.currentAction.needTransfer = true;
              },
            }),
          ],
        ],
      },
      {
        code: "transfer_taxi",
        text: "Сколько человек можешь взять с собой?",
        skipCheck: () => !this.currentAction.hasCar,
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
        skipCheck: () => !this.currentAction.needTransfer,
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
    ];

    await process.BOT.sendMessage(checkListMsgWrapper.call(this));
  }
  async getAddress() {
    const place = {
      title: "Резиденция Мария",
      address: "база отдыха Сазанка, 2, Энгельс, Саратовская область",
      latitude: 51.475479,
      longitude: 46.049778,
    };
    await process.BOT.sendVenue({ chatId: this.currentChat, ...place });
  }
  async checkListNextStep() {
    do this.checkList.currentStep++;
    while (
      (
        this.checkList.steps[this.checkList.currentStep]?.skipCheck ||
        function () {
          return false;
        }
      )()
    );

    const step = this.checkList.steps[this.checkList.currentStep];
    if (step) {
      const msg = await process.BOT.sendMessage(checkListMsgWrapper.call(this));
      this.lastMsgId = msg.message_id;
    } else {
      const query = {
        text: `
                    UPDATE users
                    SET data = data || jsonb_build_object('weddingAnswers', $1::jsonb)
                    WHERE id = $2;
                `,
        values: [this.currentAction.answers, this.id],
      };
      await process.DB.query(query);

      await process.BOT.sendMessage({
        chatId: this.currentChat,
        text: "Вы ответили на все вопросы. Спасибо!\nЧуть позже мы пришлем дополнительную информацию, так что не удаляйте этого бота. Будем на связи 😉",
      });
      this.resetCurrentAction();
    }
  }
  async saveText({ text } = {}) {
    const step = this.checkList.steps[this.checkList.currentStep];
    if (!this.currentAction.answers[step.code])
      this.currentAction.answers[step.code] = {};
    this.currentAction.answers[step.code].answerText = text;
    await this.checkListNextStep();
  }
  async saveAnswer({ data = [] } = {}) {
    const [actionName, answerCode, custom] = data;
    const answers = this.currentAction.answers;
    const step = this.checkList.steps[this.checkList.currentStep];
    if (!answers[step.code])
      answers[step.code] = step.multy ? { answerCodeList: [] } : {};

    const stepAnswer = step.inlineKeyboard
      .flat()
      .find((item) => item.code === answerCode);
    if (stepAnswer && typeof stepAnswer.pickAction === "function")
      stepAnswer.pickAction();
    if (custom === "endCheck")
      this.checkList.currentStep = this.checkList.steps.length;

    if (step.multy && custom !== "saveAnswer") {
      stepAnswer.checked = !stepAnswer.checked;
      if (stepAnswer.checked) {
        answers[step.code].answerCodeList.push(answerCode);
        stepAnswer.text = "✔️ " + stepAnswer.text;
      } else {
        answers[step.code].answerCodeList = answers[
          step.code
        ].answerCodeList.filter((code) => code !== answerCode);
        stepAnswer.text = stepAnswer.text.replace("✔️", "").trim();
      }
      await process.BOT.editMessageText(
        checkListMsgWrapper.call(this, { msgId: this.lastMsgId })
      );
    } else if (custom === "customAnswer") {
      answers[step.code].answerCode = answerCode;
      await process.BOT.editMessageText({
        chatId: this.currentChat,
        msgId: this.lastMsgId,
        text: step.text + "\n\n" + "❓ Напишите свой вариант:",
      });
      this.currentAction.onTextReceivedHandler = this.saveText.bind(this);
    } else {
      answers[step.code].answerCode = answerCode;
      await this.checkListNextStep();
    }
  }
}
