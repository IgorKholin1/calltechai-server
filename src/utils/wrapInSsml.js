function wrapInSsml(text, languageCode, voiceName = '') {
  if (languageCode === 'en-US' && voiceName === 'Polly.Joanna') {
    return `
      <speak>
        <amazon:emotion name="excited" intensity="medium">
          <prosody rate="medium" pitch="medium">
            ${text}
          </prosody>
        </amazon:emotion>
      </speak>
    `.trim();
  }

  if (languageCode === 'ru-RU' || languageCode === 'en-US') {
    return `
      <speak>
        <prosody rate="medium" pitch="medium">
          <break time="300ms"/>
          ${text}
        </prosody>
      </speak>
    `.trim();
  }

  return text;
}

module.exports = wrapInSsml;