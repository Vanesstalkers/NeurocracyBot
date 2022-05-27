export default {};

export function simpleMsgWrapper({ ...options } = {}) {
  return {
    chatId: this.currentChat,
    ...options,
  };
}
