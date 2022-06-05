import { Event } from "../Base.class.js";
import skillLST from "../lst/skill.js";

export default class Question extends Event {
  #errorIdx = 0;
  constructor() {
    super(...arguments);
  }
  static async build({ parent: user } = {}) {
    const question = new Question({ parent: user, createdFromBuilder: true });
    await question.init();
    return question;
  }
  async help() {
    const user = this.getParent();
    await BOT.sendMessage({
      chatId: user.currentChat,
      text: "Задайте вопрос, относящийся одновременно ко всем отмеченным вами темам.",
    });
  }
  async init() {
    this.skillList = [];
    this.onTextReceivedHandler = this.save;

    const skillList = Object.keys(skillLST);
    for (let j = 0; j < 4; j++) {
      const skillCode = skillList.splice(
        Math.floor(Math.random() * skillList.length),
        1
      )[0];
      this.skillList.push({
        code: skillCode,
        label: skillLST[skillCode].label,
        checked: false,
      });
    }

    await BOT.sendMessage(this.createMsg(), {
      lastMsgCheckErrorText: undefined, // тут можно написать кастомный текст
    });
  }
  createMsg({ error = null, info = null, reward = null } = {}) {
    let text =
      "Выберите от 2 до 4 сфер компетенций из предложенного списка и задайте свой вопрос, относящийся одновременно ко всем выбранным навыкам (<u>отправьте его как обычное сообщение в чат</u>).";
    text += " " + this.stringifyCheckedSkills();
    let inlineKeyboard = [
      [
        {
          text: "Заменить список",
          callback_data: "changeSkills",
        },
        { text: "ℹ️ Подсказка", callback_data: "help" },
      ],
    ].concat(this.keyboardFromSkills());

    // if (reward) {
    //   const rewardArray = getRewardArray({ rewardList: reward.data }) || [
    //     "<i>ошибка отображения награды</i>",
    //   ];
    //   // if(rewardArray.length){
    //   text = reward.text + "\n" + rewardArray.join("\n") + "\n\n" + text;
    //   // }
    //   inlineKeyboard = [];
    // }
    // if (info) {
    //   text += "\n\n" + info;
    // }
    if (error) {
      text += "\n\n" + this.stringifyError({ error });
    }
    const user = this.getParent();
    return {
      userId: user.id,
      chatId: user.currentChat,
      msgId: user.lastMsg?.id,
      text,
      inlineKeyboard,
    };
  }
  stringifyError({ error }) {
    // избавляет от ошибки "message is not modified" + визуализирует для полльзователя, что ошибка осталась
    return (
      (this.#errorIdx++ % 2 > 0 ? "❗❗❗" : "‼️‼️‼️") +
      " <b>Ошибка</b>: " +
      error
    );
  }
  async save({ text }) {
    const checkedSkillList = this.getCheckedSkills();
    const minQuestionLength = 10;
    let error = false;

    if (checkedSkillList.length < 2) {
      error = `Должно быть выбрано минимум 2 сферы компетенций.`;
    } else if (text.length < minQuestionLength) {
      error = `Длина вопроса меньше необходимой (минимальное количество символов: ${minQuestionLength}).`;
    }

    const user = this.getParent();
    if (error) {
      if (await BOT.editMessageText(this.createMsg({ error }))) {
        await user.sendSimpleError({ error });
      }
    } else {
      await DB.query(
        `
                    INSERT INTO question
                        (user_id, data, add_time, msg_id, chat_id)
                    VALUES
                        ($1, $2, NOW()::timestamp, $3, $4)
                    `,
        [
          user.id,
          { text, skillList: this.skillList },
          user.lastMsg.id,
          user.currentChat,
        ]
      );
      await this.sendSimpleAnswer({
        text:
          `Cохранен вопрос:\n<b>${text}</b>.\nВыбраные компетенции:\n` +
          checkedSkillList.map((skill) => `<b>${skill.label}</b>`).join(", ") +
          ".",
      });
      user.resetCurrentAction();
    }
  }
  getCheckedSkills() {
    return this.skillList.filter((skill) => skill.checked);
  }
  stringifyCheckedSkills() {
    const checkedSkillList = this.getCheckedSkills();
    return !checkedSkillList.length
      ? ""
      : "\n<b>Выбраны сферы:</b> " +
          checkedSkillList
            .reduce((arr, skill) => arr.concat(["✔️" + skill.label]), [])
            .join(", ") +
          ".";
  }
  keyboardFromSkills() {
    return this.skillList.map((skill) => {
      const buttonList = [
        {
          text: skill.label,
          callback_data: ["updateSkills", skill.code].join("__"),
        },
      ];
      if (skill.checked)
        buttonList.push({
          text: "отменить выбор",
          callback_data: ["updateSkills", skill.code, "delete"].join("__"),
        });
      return buttonList;
    });
  }
  async changeSkills({ msgId }) {
      // if (msgId !== this.lastMsgId) {
      //   await this.sendSimpleError({ error: "Эта задача уже не актуальна" });
      //   return; // old question button
      // }

      const msg = await BOT.sendMessage({
        chatId: this.getParent().currentChat,
        text: "ℹ️ Вы можете заменить предложенные сферы компетенций, однако платформа расценит это как недостаток соответствующих знаний и навыков, из-за чего несколько понизит оценки ваших характеристик.\n<b>Вы подтверждаете замену списка сфер компетенций для вопроса?</b>",
        inlineKeyboard: [
          [
            {
              text: "Подтвердить замену",
              callback_data: 'process.CONSTANTS.acceptChangeSkills',
            },
            {
              text: "Отменить замену",
              callback_data: 'process.CONSTANTS.cancelChangeSkills',
            },
          ],
        ],
      });
      // this.confirmMsgId = msg.message_id;
  }
}
