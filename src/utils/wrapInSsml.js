function wrapInSsml(text, languageCode) {
  if (languageCode === 'ru-RU' || languageCode === 'en-US') {
    return `<speak>${text}</speak>`;
  }
  return text;
}

module.exports = wrapInSsml;