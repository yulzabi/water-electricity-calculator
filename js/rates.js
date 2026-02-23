/**
 * Israeli utility rates for comparison
 * Updated: 2024 (approximate rates - should be updated periodically)
 */

const RATES = {
    electricity: {
        // תעריף חשמל ביתי - אגורות לקוט"ש (כולל מע"מ)
        // תעריף אחיד לצרכן ביתי
        perUnit: 0.6564, // ₪ לקוט"ש (65.64 אגורות)
        unit: 'קוט"ש',
        name: 'חשמל',
        icon: '💡',
        description: 'תעריף חח"י לצרכן ביתי (כולל מע"מ)',
        // Tolerance for fairness check (20%)
        tolerance: 0.20
    },
    water: {
        // תעריפי מים ביתיים - ₪ למ"ק (כולל מע"מ וביוב)
        lowRate: 7.536,   // תעריף נמוך - עד 3.5 מ"ק לנפש לחודש
        highRate: 14.264,  // תעריף גבוה - מעל 3.5 מ"ק לנפש לחודש
        lowThresholdPerPerson: 3.5, // מ"ק לנפש לחודש (סף תעריף נמוך)
        sewage: 0,        // ביוב כלול בתעריף
        unit: 'מ"ק',
        name: 'מים',
        icon: '💧',
        description: 'תעריף מים ביתי (כולל ביוב ומע"מ)',
        // Tolerance for fairness check (20%)
        tolerance: 0.20
    }
};

/**
 * Get the official rate for a given bill type
 * For water, returns a weighted average or range description
 */
function getOfficialRate(billType) {
    const rate = RATES[billType];
    if (!rate) return null;

    if (billType === 'electricity') {
        return {
            rate: rate.perUnit,
            description: `₪${rate.perUnit} ל${rate.unit}`,
            fullDescription: rate.description
        };
    }

    if (billType === 'water') {
        return {
            lowRate: rate.lowRate,
            highRate: rate.highRate,
            description: `₪${rate.lowRate}-${rate.highRate} ל${rate.unit}`,
            fullDescription: `${rate.description}\nתעריף נמוך: ₪${rate.lowRate} למ"ק (עד ${rate.lowThresholdPerPerson} מ"ק/נפש/חודש)\nתעריף גבוה: ₪${rate.highRate} למ"ק`
        };
    }
}

/**
 * Check if the actual rate per unit is fair compared to official rates
 * Returns: 'fair', 'warning', 'unfair'
 */
function checkRateFairness(billType, actualRatePerUnit) {
    const rate = RATES[billType];
    if (!rate) return { status: 'unknown', message: 'לא ניתן לבדוק' };

    if (billType === 'electricity') {
        const diff = Math.abs(actualRatePerUnit - rate.perUnit) / rate.perUnit;
        if (diff <= rate.tolerance) {
            return {
                status: 'fair',
                message: `✅ התעריף בפועל (₪${actualRatePerUnit.toFixed(4)}) תואם לתעריף הרשמי (₪${rate.perUnit})`
            };
        } else if (actualRatePerUnit > rate.perUnit) {
            return {
                status: 'warning',
                message: `⚠️ התעריף בפועל (₪${actualRatePerUnit.toFixed(4)}) גבוה מהתעריף הרשמי (₪${rate.perUnit}) ב-${(diff * 100).toFixed(1)}%`
            };
        } else {
            return {
                status: 'fair',
                message: `✅ התעריף בפועל (₪${actualRatePerUnit.toFixed(4)}) נמוך מהתעריף הרשמי (₪${rate.perUnit})`
            };
        }
    }

    if (billType === 'water') {
        if (actualRatePerUnit <= rate.highRate * (1 + rate.tolerance)) {
            if (actualRatePerUnit <= rate.lowRate * (1 + rate.tolerance)) {
                return {
                    status: 'fair',
                    message: `✅ התעריף בפועל (₪${actualRatePerUnit.toFixed(2)}/מ"ק) בטווח התעריף הנמוך (₪${rate.lowRate}/מ"ק)`
                };
            }
            return {
                status: 'fair',
                message: `✅ התעריף בפועל (₪${actualRatePerUnit.toFixed(2)}/מ"ק) בטווח הסביר (₪${rate.lowRate}-${rate.highRate}/מ"ק)`
            };
        } else {
            const diff = ((actualRatePerUnit - rate.highRate) / rate.highRate * 100).toFixed(1);
            return {
                status: 'warning',
                message: `⚠️ התעריף בפועל (₪${actualRatePerUnit.toFixed(2)}/מ"ק) גבוה מהתעריף הגבוה (₪${rate.highRate}/מ"ק) ב-${diff}%`
            };
        }
    }
}
