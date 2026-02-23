/**
 * Calculator module for splitting utility bills between 2 housing units
 * 
 * Simplified Logic:
 * - Total consumption comes directly from the bill
 * - Sub meter: consumption for unit 2 only (current - previous reading)
 * - Unit 1 consumption = Total consumption - Unit 2 consumption
 * - Each unit pays proportionally based on their consumption percentage
 */

const Calculator = {
    /**
     * Calculate the bill split between two units
     * @param {Object} params
     * @param {string} params.billType - 'electricity' or 'water'
     * @param {number} params.totalBill - Total bill amount in ₪
     * @param {number} params.totalConsumption - Total consumption from the bill
     * @param {number} params.subMeterPrev - Sub meter (unit 2) previous reading
     * @param {number} params.subMeterCurr - Sub meter (unit 2) current reading
     * @returns {Object} Calculation results
     */
    calculate(params) {
        const { billType, totalBill, totalConsumption, subMeterPrev, subMeterCurr } = params;

        // Validate inputs
        const validation = this.validate(params);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        // Calculate consumption
        const unit2Consumption = subMeterCurr - subMeterPrev;
        const unit1Consumption = totalConsumption - unit2Consumption;

        // Calculate percentages
        const unit2Percent = (unit2Consumption / totalConsumption) * 100;
        const unit1Percent = (unit1Consumption / totalConsumption) * 100;

        // Calculate amounts
        const unit2Amount = (totalBill * unit2Percent) / 100;
        const unit1Amount = totalBill - unit2Amount;

        // Calculate actual rate per unit
        const actualRatePerUnit = totalBill / totalConsumption;

        // Check rate fairness
        const rateCheck = checkRateFairness(billType, actualRatePerUnit);

        // Get official rate for display
        const officialRate = getOfficialRate(billType);

        // Get unit label
        const unitLabel = RATES[billType].unit;

        return {
            success: true,
            billType,
            totalBill,
            totalConsumption,
            unit1: {
                consumption: unit1Consumption,
                percent: unit1Percent,
                amount: Math.round(unit1Amount * 100) / 100
            },
            unit2: {
                consumption: unit2Consumption,
                percent: unit2Percent,
                amount: Math.round(unit2Amount * 100) / 100
            },
            actualRatePerUnit,
            officialRate,
            rateCheck,
            unitLabel,
            meters: {
                sub: { prev: subMeterPrev, curr: subMeterCurr }
            }
        };
    },

    /**
     * Validate input parameters
     */
    validate(params) {
        const { totalBill, totalConsumption, subMeterPrev, subMeterCurr } = params;

        if (!totalBill || totalBill <= 0) {
            return { valid: false, error: 'יש להזין סכום חשבונית חיובי' };
        }

        if (!totalConsumption || totalConsumption <= 0) {
            return { valid: false, error: 'יש להזין צריכה כוללת מהחשבונית' };
        }

        if (subMeterPrev === undefined || subMeterPrev === null || subMeterPrev === '' || isNaN(subMeterPrev)) {
            return { valid: false, error: 'יש להזין קריאה קודמת של מונה משני' };
        }

        if (subMeterCurr === undefined || subMeterCurr === null || subMeterCurr === '' || isNaN(subMeterCurr)) {
            return { valid: false, error: 'יש להזין קריאה נוכחית של מונה משני' };
        }

        const subConsumption = subMeterCurr - subMeterPrev;

        if (subConsumption < 0) {
            return { valid: false, error: 'קריאה נוכחית של מונה משני חייבת להיות גדולה או שווה לקריאה הקודמת' };
        }

        if (subConsumption > totalConsumption) {
            return { valid: false, error: 'צריכת המונה המשני לא יכולה להיות גדולה מהצריכה הכוללת בחשבונית' };
        }

        return { valid: true };
    },

    /**
     * Format currency amount
     */
    formatCurrency(amount) {
        return `₪${amount.toFixed(2)}`;
    },

    /**
     * Format percentage
     */
    formatPercent(percent) {
        return `${percent.toFixed(1)}%`;
    },

    /**
     * Generate WhatsApp message from results
     */
    generateWhatsAppMessage(result) {
        const typeName = RATES[result.billType].name;
        const icon = RATES[result.billType].icon;
        const date = new Date().toLocaleDateString('he-IL');

        let msg = `${icon} *חלוקת חשבון ${typeName}*\n`;
        msg += `📅 תאריך: ${date}\n`;
        msg += `━━━━━━━━━━━━━\n`;
        msg += `💰 סה"כ חשבונית: ${this.formatCurrency(result.totalBill)}\n`;
        msg += `📊 צריכה כוללת: ${result.totalConsumption} ${result.unitLabel}\n`;
        msg += `━━━━━━━━━━━━━\n`;
        msg += `🏠 *יחידה 1:*\n`;
        msg += `   צריכה: ${result.unit1.consumption} ${result.unitLabel} (${this.formatPercent(result.unit1.percent)})\n`;
        msg += `   לתשלום: *${this.formatCurrency(result.unit1.amount)}*\n`;
        msg += `\n`;
        msg += `🏠 *יחידה 2:*\n`;
        msg += `   צריכה: ${result.unit2.consumption} ${result.unitLabel} (${this.formatPercent(result.unit2.percent)})\n`;
        msg += `   לתשלום: *${this.formatCurrency(result.unit2.amount)}*\n`;
        msg += `━━━━━━━━━━━━━\n`;
        msg += `תעריף בפועל: ${this.formatCurrency(result.actualRatePerUnit)}/${result.unitLabel}`;

        return msg;
    }
};
