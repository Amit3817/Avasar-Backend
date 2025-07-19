/**
 * Corrected implementation of processMonthlyInvestmentReturns
 * 
 * This function processes monthly investment return bonuses for upline users.
 * It ensures that bonuses are processed in the correct order (month by month)
 * and only for the first 6 months.
 * 
 * To use this function, replace the existing processMonthlyInvestmentReturns
 * in referralService.js with this implementation.
 */

async function processMonthlyInvestmentReturns() {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    
    // Find all users with pending investment bonuses
    const users = await User.find({ 'investment.pendingInvestmentBonuses.0': { $exists: true } }).session(session);
    
    // Get current date info for month calculation
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-based
    const currentYear = now.getFullYear();
    
    // For testing/debugging: Process all due bonuses regardless of month
    const processAllDueBonuses = process.env.NODE_ENV !== 'production';
    let processedCount = 0;
    
    // Process each user
    for (const user of users) {
      // Skip users with no pending bonuses
      const pendingBonuses = user.investment?.pendingInvestmentBonuses || [];
      if (!pendingBonuses.length) continue;
      
      let updated = false;
      
      // Group bonuses by investment
      const investmentGroups = {};
      
      // First pass: organize bonuses by investment
      for (let i = 0; i < pendingBonuses.length; i++) {
        const bonus = pendingBonuses[i];
        
        // Skip invalid or already awarded bonuses
        if (!bonus || !bonus.type || bonus.awarded || bonus.type !== 'investmentReturn' || !bonus.investor) {
          continue;
        }
        
        // Create a unique key for each investment
        const investorId = bonus.investor.toString();
        let investmentKey;
        
        if (bonus.investmentId) {
          investmentKey = bonus.investmentId.toString();
        } else if (bonus.createdAt) {
          // Legacy support for bonuses without investmentId
          const createdAt = new Date(bonus.createdAt).toISOString().split('T')[0];
          investmentKey = `${investorId}-${createdAt}`;
        } else {
          continue; // Skip if we can't determine the investment key
        }
        
        // Initialize group if needed
        if (!investmentGroups[investmentKey]) {
          investmentGroups[investmentKey] = [];
        }
        
        // Add to group
        investmentGroups[investmentKey].push({ index: i, bonus });
      }
      
      // Second pass: process bonuses for each investment group
      for (const investmentKey in investmentGroups) {
        const bonusesForInvestment = investmentGroups[investmentKey];
        if (!bonusesForInvestment.length) continue;
        
        // Sort bonuses by month (ascending)
        bonusesForInvestment.sort((a, b) => {
          if (a.bonus.month !== b.bonus.month) {
            return a.bonus.month - b.bonus.month;
          }
          return a.index - b.index; // Stable sort
        });
        
        // Get the investment start date from the first bonus
        const firstBonus = bonusesForInvestment[0].bonus;
        if (!firstBonus.createdAt) continue;
        
        // Calculate months elapsed since investment start
        const investmentStartDate = new Date(firstBonus.createdAt);
        const monthsElapsed = (currentYear - investmentStartDate.getFullYear()) * 12 + 
                           (currentMonth - investmentStartDate.getMonth());
        
        // Find the next bonus to process
        let nextBonus = null;
        
        // First try exact month match
        nextBonus = bonusesForInvestment.find(item => 
          !item.bonus.awarded && 
          item.bonus.month <= INVESTMENT_BONUS_MONTHS && 
          item.bonus.month === monthsElapsed + 1);
        
        // If in development mode and no exact match, find the earliest non-awarded bonus
        if (processAllDueBonuses && !nextBonus) {
          nextBonus = bonusesForInvestment.find(item => 
            !item.bonus.awarded && item.bonus.month <= INVESTMENT_BONUS_MONTHS);
        }
        
        // Process the bonus if found
        if (nextBonus) {
          const { index, bonus } = nextBonus;
          
          // Double-check the 6-month limit
          if (bonus.month <= INVESTMENT_BONUS_MONTHS) {
            
            // Award the monthly investment return bonus
            user.income = user.income || {};
            user.income.investmentReferralReturnIncome = (user.income.investmentReferralReturnIncome || 0) + bonus.amount;
            user.income.walletBalance = (user.income.walletBalance || 0) + bonus.amount;
            bonus.awarded = true;
            bonus.awardedDate = new Date();
            updated = true;
            processedCount++;
            
          }
        }
      }
      
      // Save user if any bonuses were awarded
      if (updated) {
        await user.save({ session });
      }
    }
    
    // Commit transaction and return results
    await session.commitTransaction();
    
    return {
      success: true,
      message: 'Monthly investment returns processed successfully',
      processedCount
    };
  } catch (error) {
    console.error('Error in processMonthlyInvestmentReturns:', error);
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}