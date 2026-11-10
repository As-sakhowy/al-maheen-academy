(() => {
  const rate = 8;
  const buttons = [...document.querySelectorAll('.frequency-btn')];
  const cards = [...document.querySelectorAll('.plan-card')];
  function setFrequency(frequency) {
    buttons.forEach(button => {
      const active = Number(button.dataset.frequency) === frequency;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    cards.forEach(card => {
      const duration = Number(card.dataset.duration);
      const monthlyLessons = frequency * 4;
      const monthlyFee = rate * (duration / 60) * monthlyLessons;
      card.querySelector('[data-price]').textContent = `$${monthlyFee.toFixed(0)}`;
      card.querySelector('[data-detail]').textContent = `${monthlyLessons} lessons monthly · ${duration} minutes each`;
      card.querySelector('.plan-choose').href = `register.html?duration=${duration}&frequency=${frequency}`;
    });
  }
  buttons.forEach(button => button.addEventListener('click', () => setFrequency(Number(button.dataset.frequency))));
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle && links) toggle.addEventListener('click', () => { const open = links.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(open)); });
  const memberCount = document.getElementById('familyMemberCount');
  const familyDuration = document.getElementById('familyDuration');
  const familyFrequency = document.getElementById('familyFrequency');
  const individualTotal = document.getElementById('individualFamilyTotal');
  const sharedTotal = document.getElementById('sharedFamilyTotal');
  const individualBreakdown = document.getElementById('individualFamilyBreakdown');
  const sharedBreakdown = document.getElementById('sharedFamilyBreakdown');
  function updateFamilyCalculator() {
    if (!memberCount || !familyDuration || !familyFrequency) return;
    const members = Number(memberCount.value);
    const duration = Number(familyDuration.value);
    const frequency = Number(familyFrequency.value);
    const lessons = frequency * 4;
    const perLearner = rate * (duration / 60) * lessons;
    const combined = perLearner * members;
    const separateFee = combined * 0.90;
    const sharedFee = combined * 0.75;
    individualTotal.innerHTML = `$${separateFee.toFixed(2)} <small>/ month</small>`;
    sharedTotal.innerHTML = `$${sharedFee.toFixed(2)} <small>/ month</small>`;
    individualBreakdown.textContent = `${members} separate learners · $${perLearner.toFixed(2)} each before the 10% family discount · ${lessons} lessons per learner`;
    sharedBreakdown.textContent = `${members} family members · combined individual rate $${combined.toFixed(2)} before the 25% shared-learning discount · ${lessons} shared lessons`;
  }
  [memberCount, familyDuration, familyFrequency].forEach(control => control?.addEventListener('change', updateFamilyCalculator));
  updateFamilyCalculator();
  setFrequency(2);
})();