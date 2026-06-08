const EXACT_TRANSLATIONS: Record<string, string> = {
  'Email already exists': 'البريد الإلكتروني مستخدم بالفعل',
  'Invalid credentials': 'بيانات الدخول غير صحيحة',
  'An organization with this CR number already exists': 'يوجد منشأة مسجلة بهذا الرقم بالفعل',
  'A draft assessment already exists for your organization': 'يوجد تقييم مسودة للمنشأة بالفعل',
  'Assessment is already submitted': 'تم إرسال التقييم بالفعل',
  'Reset link is invalid or has expired': 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية',
  'Report is only available for submitted assessments': 'التقرير متاح فقط للتقييمات المرسلة',
  'Recommendations are only available for submitted assessments': 'التوصيات متاحة فقط للتقييمات المرسلة',
  'User not found': 'المستخدم غير موجود',
  'Unauthorized': 'غير مصرح',
  'No active session. Please log in first.': 'لا توجد جلسة نشطة. يرجى تسجيل الدخول أولاً.',
  'Unable to load user data.': 'تعذر تحميل بيانات المستخدم.',
  'Update failed.': 'فشل التحديث.',
  'Session cleared.': 'تم إنهاء الجلسة.',
  'Not authenticated': 'غير مسجل الدخول',
  'Failed to download report': 'فشل تحميل التقرير',
  'Failed to load results': 'فشل تحميل النتائج',
  'Failed to load assessment': 'فشل تحميل التقييم',
  'Failed to save answer': 'فشل حفظ الإجابة',
  'Failed to submit': 'فشل إرسال التقييم',
  'Failed to start assessment': 'فشل في بدء التقييم',
  'Cannot modify a submitted assessment': 'لا يمكن تعديل تقييم تم إرساله',
  'Assessment not found': 'التقييم غير موجود',
  'Password updated successfully. You can now sign in.': 'تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.',
  'If an account exists for that email address, a reset link has been sent.': 'إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، فقد تم إرسال رابط إعادة التعيين.',
  'An unexpected error occurred.': 'حدث خطأ غير متوقع.',
  'Unable to process your request right now.': 'تعذر تنفيذ طلبك حاليًا.',
};

const PATTERN_TRANSLATIONS: Array<[RegExp, string]> = [
  [/Password must contain at least one uppercase letter, one lowercase letter, and one digit/, 'يجب أن تحتوي كلمة المرور على حرف كبير وحرف صغير ورقم على الأقل'],
  [/must be longer than or equal to (\d+) characters/, 'يجب أن يكون $1 أحرف على الأقل'],
  [/must be shorter than or equal to (\d+) characters/, 'يجب ألا يتجاوز $1 حرف'],
  [/must be an email/, 'يجب أن يكون بريدًا إلكترونيًا صحيحًا'],
  [/must be a string/, 'يجب أن يكون نصًا'],
  [/must be one of the following values/, 'يجب أن يكون أحد القيم المحددة'],
  [/should not be empty/, 'لا يجب أن يكون فارغًا'],
  [/All (\d+) questions must be answered before submitting\. Currently answered: (\d+)/, 'يجب الإجابة على جميع الأسئلة الـ $1 قبل الإرسال. تمت الإجابة حاليًا على $2'],
  [/Only organization admins can update entity details/, 'فقط مسؤولو المنشأة يمكنهم تحديث بيانات المنشأة'],
];

export function translateError(message: string, isArabic: boolean): string {
  if (!isArabic) return message;

  // Try exact match
  const exact = EXACT_TRANSLATIONS[message];
  if (exact) return exact;

  // Handle comma-separated validation messages (class-validator returns arrays joined by ", ")
  if (message.includes(', ')) {
    const parts = message.split(', ');
    const translated = parts.map((part) => translateSingle(part));
    return translated.join('، ');
  }

  return translateSingle(message);
}

function translateSingle(message: string): string {
  // Try exact match
  const exact = EXACT_TRANSLATIONS[message];
  if (exact) return exact;

  // Strip field prefixes like "user." or "entity." from class-validator
  const stripped = message.replace(/^(user|entity)\.\s*/, '');
  const exactStripped = EXACT_TRANSLATIONS[stripped];
  if (exactStripped) return exactStripped;

  // Try pattern match
  for (const [pattern, replacement] of PATTERN_TRANSLATIONS) {
    if (pattern.test(message) || pattern.test(stripped)) {
      return (stripped || message).replace(pattern, replacement);
    }
  }

  // Fallback: return original
  return message;
}
