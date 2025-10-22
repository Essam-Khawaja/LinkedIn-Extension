export default defineContentScript({
  matches: [
    '*://*.greenhouse.io/*',
    '*://*.lever.co/*',
    '*://linkedin.com/jobs/*/apply/*',
  ],
  
  async main() {
    console.log('Auto-fill loaded');
    addAutoFillButton();
  }
});

class FormFieldDetector {
  getAllFields() {
    const inputs = document.querySelectorAll('input');
  }
}

class FormFiller {
  constructor(private profile: any) {}
  
  async fillForm() {
    const detector = new FormFieldDetector();
  }
}

class AIQuestionAnswerer {
  async answerQuestion(question: string) {
    // @ts-ignore
    const session = await window.ai.languageModel.create();
    // ...
  }
}

function addAutoFillButton() {
  const button = document.createElement('button');
  // ...
  button.onclick = async () => {
    const { profile } = await browser.storage.local.get('profile');
    const filler = new FormFiller(profile);
    await filler.fillForm();
  };
  document.body.appendChild(button);
}