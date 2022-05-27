export default {};

export function simpleMsgWrapper({ ...options } = {}) {
  return {
    chatId: this.currentChat,
    ...options,
  };
}

export function checkListMsgWrapper({ msgId } = {}) {
  try {
      const chatId = this.currentChat;
      const step = this.checkList.steps[ this.checkList.currentStep ];
      if(step){
          this.waitForText = step.waitForText;
          return {chatId, msgId, text: step.text, inlineKeyboard: step.inlineKeyboard};
      }else{
          return {};
      }
  } catch (err) { console.log(err) }
}
