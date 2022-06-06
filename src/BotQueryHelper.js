export default {};

export function simpleMsgWrapper({ ...options } = {}) {
  return {
    userId: this.id,
    chatId: this.currentChat,
    ...options,
  };
}

export function checkListMsgWrapper({ msgId } = {}) {
  const chatId = this.currentChat;
  const step = this.checkList.steps[this.checkList.currentStep];
  if (step) {
    this.waitForText = step.waitForText;
    return {
      chatId,
      msgId,
      text: step.text,
      inlineKeyboard: step.inlineKeyboard,
    };
  } else {
    return {};
  }
}
