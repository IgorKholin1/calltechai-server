function getEmpatheticResponse(text, lang = 'en') {
    const lowered = (text || '').toLowerCase().trim();
  
    const empatheticTriggers = {
      ru: [
        'мне страшно',
        'я боюсь',
        'я переживаю',
        'я стесняюсь',
        'вы добрые',
        'это больно',
        'будет больно'
      ],
      en: [
        "i'm scared",
        "i'm afraid",
        "i'm nervous",
        "is it painful",
        "does it hurt",
        "are you nice",
        "will it hurt"
      ]
    };
  
    const responseMap = {
      ru: "Не волнуйтесь, всё будет хорошо. Я рядом и помогу вам.",
      en: "Don't worry, everything will be okay. I’m here to help you."
    };
  
    if (empatheticTriggers[lang]?.some(trigger => lowered.includes(trigger))) {
      return responseMap[lang];
    }
  
    return null;
  }
  
  module.exports = { getEmpatheticResponse };