function wrapInSsml(text, languageCode, voiceName = '') {
  // Английский с кастомной эмоцией только для Joanna
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

  // Русский или другие английские голоса (например, не Joanna)
  if (languageCode === 'ru-RU') {
    return `
      <speak>
        <prosody rate="medium" pitch="medium">
          <break time="300ms"/>
          ${text}
        </prosody>
      </speak>
    `.trim();
  }

  // Остальные случаи — просто return без SSML
  return text;
}

module.exports = wrapInSsml;