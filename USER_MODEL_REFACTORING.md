# User Model Refactoring

## Overview

The User model has been refactored to use subdocuments for better organization and maintainability. This addresses the issue of the model becoming too large and mixing different concerns.

## Problem

The original User model had grown to 52 fields, mixing:
- Authentication data
- Profile data  
- Referral data
- Income data
- Investment data
- Team data
- System data

This violated the Single Responsibility Principle and made the model hard to maintain.

## Solution

### New Structure

The User model now uses subdocuments organized by concern:

```javascript
const userSchema = new mongoose.Schema({
  profile: { type: profileSchema, default: () => ({}) },      // Personal info
  auth: { type: authSchema, default: () => ({}) },           // Authentication
  referral: { type: referralSchema, default: () => ({}) },   // Referral system
  income: { type: incomeSchema, default: () => ({}) },       // All income types
  investment: { type: investmentSchema, default: () => ({}) }, // Investment data
  system: { type: systemSchema, default: () => ({}) },       // System tracking
  createdAt: { type: Date, default: Date.now }
});
```

### Subdocument Breakdown

#### 1. **Profile Schema**
```javascript
{
  fullName: String,
  phone: { type: String, unique: true },
  profilePicture: { type: String, default: '' },
  position: { type: String, enum: ['left', 'right', null], default: null },
  rank: { type: String, default: 'Associate' }
}
```

#### 2. **Auth Schema**
```javascript
{
  email: { type: String, unique: true },
  password: String,
  isVerified: { type: Boolean, default: false },
  otp: String,
  otpExpires: Date,
  otpAttempts: { type: Number, default: 0 },
  otpLockedUntil: { type: Date, default: null },
  isAdmin: { type: Boolean, default: false }
}
```

#### 3. **Referral Schema**
```javascript
{
  referralCode: { type: String, unique: true, index: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  leftChildren: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  rightChildren: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  directReferralCount: { type: Number, default: 0 },
  directReferrals: { type: Number, default: 0 },
  teamSize: { type: Number, default: 0 }
}
```

#### 4. **Income Schema**
```javascript
{
  referralIncome: { type: Number, default: 0 },
  matchingIncome: { type: Number, default: 0 },
  rewardIncome: { type: Number, default: 0 },
  investmentIncome: { type: Number, default: 0 },
  investmentReferralIncome: { type: Number, default: 0 },
  investmentReferralPrincipalIncome: { type: Number, default: 0 },
  investmentReferralReturnIncome: { type: Number, default: 0 },
  referralInvestmentPrincipal: { type: Number, default: 0 },
  walletBalance: { type: Number, default: 0 }
}
```

#### 5. **Investment Schema**
```javascript
{
  totalInvestment: { type: Number, default: 0 },
  investmentStartDate: { type: Date, default: null },
  investmentEndDate: { type: Date, default: null },
  investmentLockInPeriod: { type: Number, default: 24 },
  investmentIsLocked: { type: Boolean, default: false },
  lockedInvestmentAmount: { type: Number, default: 0 },
  availableForWithdrawal: { type: Number, default: 0 },
  pendingInvestmentBonuses: { type: Array, default: [] }
}
```

#### 6. **System Schema**
```javascript
{
  pairs: { type: Number, default: 0 },
  totalPairs: { type: Number, default: 0 },
  awardedRewards: [{ type: String }],
  matchingPaid: { type: Boolean, default: false },
  matchingPairsToday: { type: Object, default: {} }
}
```

## Backward Compatibility

Virtual getters and setters ensure that existing code continues to work:

```javascript
// Virtual getters
userSchema.virtual('fullName').get(function() { return this.profile?.fullName; });
userSchema.virtual('email').get(function() { return this.auth?.email; });
// ... etc

// Virtual setters  
userSchema.virtual('fullName').set(function(value) { if (!this.profile) this.profile = {}; this.profile.fullName = value; });
userSchema.virtual('email').set(function(value) { if (!this.auth) this.auth = {}; this.auth.email = value; });
// ... etc
```

This means existing code like `user.fullName` or `user.email` will continue to work without changes.

## Migration

### Running the Migration

1. **Backup your database first!**
2. Run the migration script:

```bash
cd backend
node migrate-user-model.js
```

### What the Migration Does

- Checks if users already have the new structure
- Converts flat structure to subdocument structure
- Preserves all existing data
- Logs progress and any errors

## Benefits

1. **Better Organization**: Related fields are grouped together
2. **Easier Maintenance**: Each subdocument has a single responsibility
3. **Improved Readability**: Clear separation of concerns
4. **Better Performance**: Can query specific subdocuments
5. **Backward Compatibility**: Existing code continues to work
6. **Future-Proof**: Easy to add new fields to appropriate subdocuments

## Usage Examples

### Accessing Data (Both ways work)

```javascript
// Old way (still works)
const userName = user.fullName;
const userEmail = user.email;

// New way (more explicit)
const userName = user.profile.fullName;
const userEmail = user.auth.email;
```

### Updating Data

```javascript
// Old way (still works)
user.fullName = 'New Name';
await user.save();

// New way (more explicit)
user.profile.fullName = 'New Name';
await user.save();
```

### Querying

```javascript
// Query by subdocument fields
const users = await User.find({ 'auth.isAdmin': true });
const users = await User.find({ 'profile.rank': 'Manager' });
const users = await User.find({ 'income.walletBalance': { $gt: 1000 } });
```

## Indexes

Indexes have been updated to work with the new structure:

```javascript
userSchema.index({ 'referral.referredBy': 1 });
userSchema.index({ 'referral.leftChildren': 1 });
userSchema.index({ 'referral.rightChildren': 1 });
userSchema.index({ 'referral.referralCode': 1 });
userSchema.index({ 'auth.email': 1 });
userSchema.index({ 'profile.phone': 1 });
```

## Future Considerations

1. **Gradual Migration**: Consider gradually updating code to use the new explicit structure
2. **Validation**: Add validation at the subdocument level
3. **Methods**: Add methods to subdocuments for common operations
4. **Population**: Consider population strategies for subdocuments

## Rollback Plan

If needed, you can rollback by:
1. Restoring the old User model
2. Running a reverse migration script
3. The virtual getters/setters ensure compatibility during transition 