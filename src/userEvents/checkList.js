import { Event } from "../Base.class.js";

export default class CheckList extends Event {
  answers = {};
  currentStep = 0;
  constructor() {
    super(...arguments);
  }
  static async build({ parent: user } = {}) {
    return new CheckList({ parent: user, createdFromBuilder: true });
  }
  async start() {
    await BOT.sendMessage(this.checkListMsgWrapper(), {
      lastMsgCheckErrorText: undefined, // тут можно написать кастомный текст
    });
  }
  async help() {
    const user = this.getParent();
    await BOT.sendMessage({
      chatId: user.currentChat,
      text: "Последовательно отвечайте на вопросы. Ссылка на последний вопрос прикреплена к этому сообщению.",
      replyId: user.lastMsg?.id,
    });
  }
  setSteps(steps) {
    this.steps = steps;
  }
  setFinalAction(action){
    this.finalAction = action;
  }
  saveAnswerCB(obj, ...params) {
    obj.callback_data = ["saveAnswer", obj.code].concat(params).join("__");
    return obj;
  }
  checkListMsgWrapper({ msgId } = {}) {
    const step = this.steps[this.currentStep];
    if (step) {
      this.waitForText = step.waitForText;
      const user = this.getParent();
      return {
        userId: user.id,
        chatId: user.currentChat,
        msgId,
        text: step.text,
        inlineKeyboard: step.inlineKeyboard,
      };
    } else {
      return {};
    }
  }
  async saveAnswer({ msgId, data = [] } = {}) {
    const user = this.getParent();
    if (!(await user.lastMsgCheck({ msgId }))) return;

    const [actionName, answerCode, custom] = data;
    const answers = this.answers;
    const step = this.steps[this.currentStep];
    if (!answers[step.code])
      answers[step.code] = step.multy ? { answerCodeList: [] } : {};

    const stepAnswer = step.inlineKeyboard
      .flat()
      .find((item) => item.code === answerCode);
    if (stepAnswer && typeof stepAnswer.pickAction === "function")
      stepAnswer.pickAction.call(this);
    if (custom === "endCheck") this.currentStep = this.steps.length;

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
      await BOT.editMessageText(this.checkListMsgWrapper({ msgId }));
    } else if (custom === "customAnswer") {
      answers[step.code].answerCode = answerCode;
      await BOT.editMessageText({
        userId: user.id,
        chatId: user.currentChat,
        msgId: msgId,
        text: step.text + "\n\n" + "❓ Напишите свой вариант:",
      });
      this.onTextReceivedHandler = this.saveText;
    } else {
      answers[step.code].answerCode = answerCode;
      await this.checkListNextStep();
    }
  }
  async checkListNextStep() {
    do this.currentStep++;
    while (
      (
        this.steps[this.currentStep]?.skipCheck ||
        function () {
          return false;
        }
      ).call(this)
    );

    const step = this.steps[this.currentStep];
    if (step) {
      await BOT.sendMessage(this.checkListMsgWrapper(), {
        lastMsgCheckErrorText: undefined, // тут можно написать кастомный текст
      });
    } else {
      if(this.finalAction) await this.finalAction();
    }
  }
  async saveText({ text } = {}) {
    const step = this.steps[this.currentStep];
    if (!this.answers[step.code]) this.answers[step.code] = {};
    this.answers[step.code].answerText = text;
    await this.checkListNextStep();
  }
}
