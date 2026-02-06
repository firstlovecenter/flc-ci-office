# Multi-Currency System - User Guide for National Admins

## Overview

The FLC Accounts system now supports **multi-currency operations** with **automatic conversion** based on your department level and preferences.

## How It Works

### Currency Display Rules

Your dashboard and transaction amounts are displayed in different currencies depending on your role:

| Your Role | Base Currency You See |
|-----------|----------------------|
| **International Admin/Leader** | USD (System Default) |
| **Global Admin/Leader** | USD (System Default) |
| **National Admin/Leader** | Your national department's selected currency |
| **Regional/Campus/Stream/Council** | Your parent national department's currency |

### For National Admins: Selecting Your Base Currency

As a **National Admin**, you can choose which currency you want to see amounts in:

1. **Go to Transactions Page**
2. **Look for "Base Currency" dropdown** in the filter section (top of page)
3. **Select your preferred currency** (e.g., GHS, USD, EUR, etc.)
4. **System automatically recalculates** all your department's transactions

#### What Happens When You Change Base Currency?

- ✅ All transactions are instantly recalculated
- ✅ Dashboard stats update to show correct totals
- ✅ Transaction list displays amounts in your selected currency
- ✅ Everyone in your department tree sees the same currency
- ✅ Original transaction data is preserved

### Example: FL Ghana

**Scenario:** FL Ghana National Admin selects **GHS** as base currency

**Before (USD system default):**
```
Income: $50,000 USD
Expense: $30,000 USD
Balance: $20,000 USD
```

**After selecting GHS (exchange rate: 1 USD = 11 GHS):**
```
Income: 550,000 GHS
Expense: 330,000 GHS
Balance: 220,000 GHS
```

**Mixed Currency Transactions:**
- Transaction in USD: $10,000 → Shown as 110,000 GHS
- Transaction in GHS: 50,000 → Shown as 50,000 GHS (no conversion)

## Recording Transactions

### Currency Selection When Creating Transactions

When you record a new transaction:

1. **Select the actual currency** of the transaction (USD, GHS, EUR, etc.)
2. **Enter the amount** in that currency
3. **System automatically converts** to your base currency for reporting

**Important:** 
- Always record in the **actual currency used**
- The system handles conversion for you
- Exchange rates are preserved for historical accuracy

### Example

If you're FL Ghana (base: GHS) and receive $5,000 USD donation:

1. Create transaction
2. Select currency: **USD**
3. Enter amount: **5,000**
4. System converts: 5,000 USD × 11 = **55,000 GHS** (for your view)
5. Original $5,000 USD is preserved in database

## Understanding Exchange Rates

### How Exchange Rates Are Used

- Exchange rates are set by **Super Admins**
- Rates are **bidirectional** (can convert both ways)
- System uses the **effective date** for historical transactions
- If no rate exists, original amount is displayed

### Viewing Exchange Rates

You can view current exchange rates at: **Currencies > Exchange Rates**

Example rates:
```
USD → GHS: 11.00 (multiply by 11)
GHS → USD: 0.0909 (divide by 11, or multiply by rate)
```

## Reports and Dashboard

### Dashboard Stats

Your dashboard shows:
- **Total Income** (in your base currency)
- **Total Expenses** (in your base currency)
- **Net Balance** (income - expenses)

All amounts are **automatically converted** from their original currency to your selected base currency.

### Transaction List

Each transaction displays:
- **Original amount** and currency
- **Converted amount** in your base currency (in the "Amount in Base" column)
- **Exchange rate** used (if applicable)

## For Sub-National Users

If you are a **Regional Admin/Leader, Campus Admin/Leader, or Stream/Council Leader**:

- You **cannot** select your own base currency
- You **automatically inherit** your National Admin's selection
- Your amounts display in the **same currency** as your National department
- You can still **record transactions** in any active currency

## Troubleshooting

### "My amounts aren't showing in the right currency"

1. **Check your role:** Only National Admins can select base currency
2. **Verify selection:** Go to Transactions page, check Base Currency dropdown
3. **Refresh page:** Sometimes browser cache needs clearing

### "Conversions seem wrong"

1. **Check exchange rates:** Navigate to Currencies > Exchange Rates
2. **Verify rate direction:** USD→GHS vs GHS→USD
3. **Contact support:** If rates are missing or incorrect

### "I changed base currency but amounts didn't update"

1. **Wait a moment:** Recalculation takes 2-10 seconds depending on transaction count
2. **Refresh page:** Press F5 or reload the page
3. **Check browser console:** Look for any error messages (F12 → Console tab)

## Best Practices

### ✅ DO:
- Record transactions in their **actual currency**
- Select your national base currency **once** and stick with it
- Review exchange rates periodically
- Check converted amounts make sense

### ❌ DON'T:
- Convert amounts manually before entering
- Change base currency frequently (causes confusion)
- Record USD amounts as GHS (or vice versa)
- Ignore exchange rate warnings

## Technical Details (For Reference)

### How Conversion Works

```
1. You log in as National Admin
2. System checks: "What's this user's base currency?"
3. For each transaction:
   a. Get original amount (e.g., $10,000 USD)
   b. Get your base currency (e.g., GHS)
   c. Find exchange rate (USD→GHS = 11)
   d. Calculate: $10,000 × 11 = 110,000 GHS
   e. Display: "110,000 GHS"
4. Dashboard totals sum all converted amounts
```

### Conversion Priority

The system tries these methods **in order**:

1. **Same currency?** No conversion needed
2. **Direct rate?** Use it (e.g., USD→GHS: multiply)
3. **Reverse rate?** Invert it (e.g., GHS→USD: divide)
4. **No rate?** Show original amount

## Getting Help

### Need Support?

Contact your system administrator if:
- Exchange rates are missing
- Conversions seem incorrect
- You can't access the base currency selector
- Transactions aren't recalculating

### Reporting Issues

When reporting currency issues, include:
1. Your department name
2. Your selected base currency
3. Screenshot of the problem
4. Example transaction showing wrong conversion

## Summary

The multi-currency system is designed to:
- **Simplify** reporting in your local currency
- **Preserve** original transaction data
- **Automatically convert** amounts for you
- **Support** international financial operations

**Key Takeaway:** Record transactions in their actual currency, select your preferred base currency once, and let the system handle the rest!

---

**Questions?** Reach out to the Super Admin team.

**Last Updated:** Current Release
**System Status:** ✅ Fully Operational
