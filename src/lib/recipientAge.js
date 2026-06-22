function integer(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasBirthday(month, day) {
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

export function calculateCurrentAge(birthYearValue, monthValue, dayValue, now = new Date()) {
  const birthYear = integer(birthYearValue);
  const month = integer(monthValue);
  const day = integer(dayValue);
  if (!birthYear || birthYear < 1800 || birthYear > now.getFullYear()) return null;

  let age = now.getFullYear() - birthYear;
  if (hasBirthday(month, day)) {
    const birthdayStillAhead = month > now.getMonth() + 1
      || (month === now.getMonth() + 1 && day > now.getDate());
    if (birthdayStillAhead) age -= 1;
  }
  return Math.max(age, 0);
}

export function deriveBirthYearFromCurrentAge(ageValue, monthValue, dayValue, now = new Date()) {
  const age = integer(ageValue);
  const month = integer(monthValue);
  const day = integer(dayValue);
  if (age === null || age < 0 || age > 130 || !hasBirthday(month, day)) return null;

  const birthdayStillAhead = month > now.getMonth() + 1
    || (month === now.getMonth() + 1 && day > now.getDate());
  return now.getFullYear() - age - (birthdayStillAhead ? 1 : 0);
}

export function deriveBirthYearFromTurningAge(ageValue, eventDate) {
  const age = integer(ageValue);
  const eventYear = integer(String(eventDate || '').slice(0, 4));
  if (age === null || age < 0 || age > 130 || !eventYear) return null;
  return eventYear - age;
}

export function turningAgeOnDate(birthYearValue, eventDate) {
  const birthYear = integer(birthYearValue);
  const eventYear = integer(String(eventDate || '').slice(0, 4));
  if (!birthYear || !eventYear || eventYear < birthYear) return null;
  return eventYear - birthYear;
}

export function normalizeRecipientAgeFields(data, now = new Date()) {
  const birthdayMonth = integer(data?.birthday_month);
  const birthdayDay = integer(data?.birthday_day);
  let birthYear = integer(data?.birth_year);
  let age = integer(data?.age);

  if (birthYear) {
    age = calculateCurrentAge(birthYear, birthdayMonth, birthdayDay, now);
  } else if (age !== null && hasBirthday(birthdayMonth, birthdayDay)) {
    birthYear = deriveBirthYearFromCurrentAge(age, birthdayMonth, birthdayDay, now);
  }

  return {
    age: age === null ? undefined : age,
    birth_year: birthYear || undefined,
    birthday_month: birthdayMonth || undefined,
    birthday_day: birthdayDay || undefined,
  };
}

export function ageForRecipient(recipient, now = new Date()) {
  if (recipient?.birth_year) {
    return calculateCurrentAge(
      recipient.birth_year,
      recipient.birthday_month,
      recipient.birthday_day,
      now,
    );
  }
  return integer(recipient?.age);
}

export function syncRecipientAgeForm(previous, updates, now = new Date()) {
  const next = { ...previous, ...updates };
  const birthYearChanged = Object.prototype.hasOwnProperty.call(updates, 'birth_year');

  if (birthYearChanged && String(next.birth_year || '').length === 4) {
    const age = calculateCurrentAge(next.birth_year, next.birthday_month, next.birthday_day, now);
    if (age !== null) next.age = String(age);
    return next;
  }

  if (!next.birth_year && next.age && next.birthday_month && next.birthday_day) {
    const birthYear = deriveBirthYearFromCurrentAge(next.age, next.birthday_month, next.birthday_day, now);
    if (birthYear) next.birth_year = String(birthYear);
  } else if (next.birth_year) {
    const age = calculateCurrentAge(next.birth_year, next.birthday_month, next.birthday_day, now);
    if (age !== null) next.age = String(age);
  }

  return next;
}
