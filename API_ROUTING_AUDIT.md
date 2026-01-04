# RapidReps API & Routing Audit Report

## 🔍 CRITICAL ISSUES FOUND

### Issue #1: Missing traineeAPI.getMyProfile() Method
**Severity:** HIGH
**Location:** `/app/frontend/src/services/api.ts`
**Problem:** The trainee profile screen tries to call `traineeAPI.getMyProfile()` but this method doesn't exist. The trainerAPI has it, but traineeAPI doesn't.
**Impact:** Trainee profile may not load correctly.
**Fix Required:** Add getMyProfile method to traineeAPI

### Issue #2: Missing Achievements API Endpoints in Frontend
**Severity:** MEDIUM
**Location:** `/app/frontend/src/services/api.ts`
**Problem:** Backend has `/trainer/achievements` and `/trainee/achievements` endpoints, but the frontend api.ts doesn't have wrapper methods.
**Impact:** Achievement screens might be making direct axios calls instead of using the API service.
**Fix Required:** Add achievements methods to trainerAPI and traineeAPI

### Issue #3: Duplicate Route Files (Old vs Tab-based)
**Severity:** HIGH
**Location:** `/app/frontend/app/trainee/`
**Problem:** Two versions of key files exist:
- `/trainee/home.tsx` (OLD - unused)
- `/trainee/(tabs)/home.tsx` (NEW - active)
- `/trainee/profile.tsx` (OLD - unused)
- `/trainee/(tabs)/profile.tsx` (NEW - active)
**Impact:** Confusion, potential wrong route navigation, maintenance nightmare.
**Fix Required:** Delete old files OR redirect them to tab versions

### Issue #4: Login Redirects to Wrong Trainee Route
**Severity:** CRITICAL
**Location:** `/app/frontend/app/auth/login.tsx` (line 41)
**Problem:** After login, trainee redirects to `/trainee/home` but should go to `/trainee/(tabs)/home`
**Impact:** Trainees land on old screen or get error after login.
**Fix Required:** Change redirect to `/trainee/(tabs)/home`

### Issue #5: Onboarding Redirects to Wrong Route  
**Severity:** CRITICAL
**Location:** `/app/frontend/app/auth/onboarding-trainee.tsx` (line 195)
**Problem:** After onboarding completion, redirects to `/trainee/home` instead of `/trainee/(tabs)/home`
**Impact:** New trainees land on wrong screen after setup.
**Fix Required:** Change redirect to `/trainee/(tabs)/home`

### Issue #6: Multiple Screens Navigating to Old Routes
**Severity:** HIGH
**Locations:**
- `/trainee/my-sessions.tsx` → navigates to `/trainee/home` (should be tabs)
- `/trainee/session-complete.tsx` → navigates to `/trainee/home` (should be tabs)
- `/trainee/session-active.tsx` → navigates to `/trainee/home` (should be tabs)
**Impact:** Users navigating from sessions land on old screens.
**Fix Required:** Update all navigation calls to use `/trainee/(tabs)/home`

---

## ✅ CORRECTLY IMPLEMENTED

### API Endpoints Match Frontend Calls
- ✅ Auth endpoints (signup, login, getMe, deleteMe)
- ✅ Safety endpoints (report, block, unblock, getBlocks)
- ✅ Trainer profile endpoints
- ✅ Trainee profile endpoints  
- ✅ Session endpoints (create, get, accept, decline, complete)
- ✅ Rating endpoints
- ✅ Search endpoints

### Routing Structure is Logical
- ✅ Root layout at `/_layout.tsx`
- ✅ Tab layout at `/trainee/(tabs)/_layout.tsx`
- ✅ Auth flow: signup → onboarding → home
- ✅ Trainer flow: single-screen navigation (no tabs)
- ✅ Trainee flow: tab-based navigation

---

## 📋 REQUIRED FIXES SUMMARY

**Immediate (Critical):**
1. Fix login redirect to use `/trainee/(tabs)/home`
2. Fix onboarding redirect to use `/trainee/(tabs)/home`
3. Add `traineeAPI.getMyProfile()` method
4. Update all session screens to navigate to `/trainee/(tabs)/home`

**Important (High Priority):**
5. Delete or redirect duplicate trainee files
6. Add achievements API methods to api.ts

**Optional (Nice to Have):**
7. Add TypeScript types for all API responses
8. Create route constants file to avoid typos

---

## 🔧 RECOMMENDED IMPLEMENTATION ORDER

1. **First:** Fix API service (add missing methods)
2. **Second:** Fix critical redirects (login, onboarding)
3. **Third:** Update session screens navigation
4. **Fourth:** Clean up duplicate files
5. **Fifth:** Add route constants for maintainability
