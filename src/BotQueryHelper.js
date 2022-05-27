export default {};

export function startMenuMsg({ text, inlineKeyboard } = {}) {
  return {
    chatId: this.currentChat,
    text,
    inlineKeyboard,
  };
}
