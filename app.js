// // app.js - COMPLETE WITH CORRECT RELEASE LOGIC (Student stays hidden after release)
// import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
// import { getDatabase, ref, push, set, onValue, remove, get, query, orderByChild, limitToLast } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
// import { getMessaging, getToken, onMessage, isSupported } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js';

// // Firebase Config
// const firebaseConfig = {
//     apiKey: "AIzaSyCAai2enHwfyrxcBpu556rtKSw9sjtyAno",
//     authDomain: "tunis-school-dismissal.firebaseapp.com",
//     projectId: "tunis-school-dismissal",
//     storageBucket: "tunis-school-dismissal.firebasestorage.app",
//     messagingSenderId: "490622758126",
//     appId: "1:490622758126:web:54221213cd1c2c5e2657ff",
//     measurementId: "G-0H39R6ESX0",
//     databaseURL: "https://tunis-school-dismissal-default-rtdb.europe-west1.firebasedatabase.app/"
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const db = getDatabase(app);
// let messaging = null;

// // ==================== OPTIMIZATIONS ====================

// const STUDENT_CACHE_KEY = 'maarif_students_cache';
// const CACHE_EXPIRY = 5 * 60 * 1000;

// const clickCooldown = new Map();
// const COOLDOWN_TIME = 3000;

// // YEAR-BASED FILTERING
// let currentYearFilter = 'all';
// let allPendingPickups = [];

// // Student Data
// let students = [];
// let isLoadingStudents = false;
// let studentLoadPromise = null;

// // Track which students have disabled buttons (already marked)
// let disabledStudentButtons = new Set();

// // Track which students have been released (stay hidden)
// let releasedStudentsToday = new Set();

// // Check if messaging is supported
// (async() => {
//     if (await isSupported()) {
//         messaging = getMessaging(app);
//         setupNotifications();
//     } else {
//         console.log('Firebase Messaging not supported');
//         const notifBtn = document.getElementById('request-notif');
//         if (notifBtn) notifBtn.style.display = 'none';
//     }
// })();

// // ==================== DAILY RESET SYSTEM ====================

// async function checkAndResetForNewDay() {
//     try {
//         const lastResetRef = ref(db, 'system/lastReset');
//         const snapshot = await get(lastResetRef);
//         const today = new Date().toDateString();

//         if (!snapshot.exists()) {
//             await set(lastResetRef, { date: today, timestamp: Date.now() });
//             console.log('System initialized with date:', today);
//             return;
//         }

//         const lastResetDate = snapshot.val().date;

//         if (lastResetDate !== today) {
//             console.log('New day detected! Resetting system...');
//             await resetSystemForNewDay();
//             await set(lastResetRef, { date: today, timestamp: Date.now() });
//             disabledStudentButtons.clear();
//             releasedStudentsToday.clear(); // Clear released students for new day
//             showToast('🔄 System reset for new day - All students available', 'success');
//         }
//     } catch (error) {
//         console.error('Error checking daily reset:', error);
//     }
// }

// async function resetSystemForNewDay() {
//     try {
//         const pendingRef = ref(db, 'pendingPickups');
//         const pendingSnapshot = await get(pendingRef);

//         if (pendingSnapshot.exists()) {
//             const pendingData = pendingSnapshot.val();
//             const yesterday = new Date();
//             yesterday.setDate(yesterday.getDate() - 1);
//             const archiveDate = yesterday.toDateString().replace(/\s/g, '_');
//             const archiveRef = ref(db, `archive/${archiveDate}`);
//             await set(archiveRef, {
//                 pendingPickups: pendingData,
//                 archivedAt: Date.now(),
//                 archivedDate: yesterday.toDateString()
//             });
//         }

//         const releasedRef = ref(db, 'releasedPickups');
//         const releasedSnapshot = await get(releasedRef);

//         if (releasedSnapshot.exists()) {
//             const releasedData = releasedSnapshot.val();
//             const yesterday = new Date();
//             yesterday.setDate(yesterday.getDate() - 1);
//             const archiveDate = yesterday.toDateString().replace(/\s/g, '_');
//             const archiveReleasedRef = ref(db, `archive/${archiveDate}/releasedPickups`);
//             await set(archiveReleasedRef, releasedData);
//         }

//         await remove(ref(db, 'pendingPickups'));
//         await remove(ref(db, 'releasedPickups'));

//         updatePendingCount();
//         updateReleasedCount();

//     } catch (error) {
//         console.error('Error resetting system:', error);
//         showToast('Error resetting system', 'error');
//     }
// }

// // ==================== OPTIMIZED STUDENT LOADING ====================

// async function loadStudentsFromCSV() {
//     if (studentLoadPromise) return studentLoadPromise;

//     const cached = getCachedStudents();
//     if (cached) {
//         console.log('Using cached students');
//         students = cached;
//         updateStudentCount();
//         renderStudentList();
//         updateYearFilterButtons();
//         return Promise.resolve(students);
//     }

//     isLoadingStudents = true;
//     updateLoadingUI(true);

//     studentLoadPromise = loadStudentsFromCSVInternal()
//         .then(result => {
//             students = result;
//             cacheStudents(students);
//             updateStudentCount();
//             renderStudentList();
//             updateYearFilterButtons();
//             isLoadingStudents = false;
//             updateLoadingUI(false);
//             return students;
//         })
//         .catch(error => {
//             console.error('Failed to load students:', error);
//             loadFallbackStudents();
//             isLoadingStudents = false;
//             updateLoadingUI(false);
//             throw error;
//         });

//     return studentLoadPromise;
// }

// async function loadStudentsFromCSVInternal() {
//     console.log('Loading students from CSV...');

//     try {
//         const cacheBuster = `?t=${Date.now()}`;
//         const response = await fetch(`./students.csv${cacheBuster}`);

//         if (!response.ok) throw new Error('CSV file not found');

//         const text = await response.text();
//         const lines = text.trim().split('\n');
//         const loadedStudents = [];

//         for (let i = 1; i < lines.length; i++) {
//             const line = lines[i].trim();
//             if (!line) continue;

//             const parts = line.split(',');
//             if (parts.length >= 2) {
//                 const name = parts[0].trim();
//                 const className = parts[1].trim();

//                 if (name) {
//                     const year = extractYearFromClassName(className);
//                     loadedStudents.push({
//                         name: name,
//                         class: className,
//                         year: year,
//                         id: `${name.toLowerCase().replace(/\s+/g, '_')}_${className}_${year}`
//                     });
//                 }
//             }

//             if (i % 50 === 0) {
//                 await new Promise(resolve => setTimeout(resolve, 0));
//             }
//         }

//         console.log(`Loaded ${loadedStudents.length} students`);
//         return loadedStudents;

//     } catch (err) {
//         console.error('Error loading CSV:', err);
//         throw err;
//     }
// }

// function extractYearFromClassName(className) {
//     className = className.trim();
//     if (className.toUpperCase().includes('KG')) {
//         return className.toUpperCase();
//     }
//     const yearMatch = className.match(/Year\s*(\d+)/i);
//     if (yearMatch) {
//         return `Year ${yearMatch[1]}`;
//     }
//     return 'Other';
// }

// function getYearDisplayName(year) {
//     if (year.includes('KG')) return year.toUpperCase();
//     if (year.includes('Year')) return year;
//     return year;
// }

// function loadFallbackStudents() {
//     console.log('Loading fallback students');
//     students = [
//         { name: "AILA ALLA", class: "KG1", year: "KG1", id: "aila_alla_kg1" },
//         { name: "AMIN OSMAN", class: "kg2", year: "KG2", id: "amin_osman_kg2" },
//         { name: "AYLA ERDOĞAN", class: "Year 1", year: "Year 1", id: "ayla_erdogan_year1" },
//         { name: "AWES AYARI", class: "Year 2", year: "Year 2", id: "awes_ayari_year2" },
//         { name: "ADAM KHALIFA ElSHAWESH", class: "Year 3", year: "Year 3", id: "adam_khalifa_elshawesh_year3" },
//         { name: "BAYA MEFTEH", class: "Year 4", year: "Year 4", id: "baya_mefteh_year4" },
//         { name: "AHMED KARIM OTHMAN", class: "Year 5", year: "Year 5", id: "ahmed_karim_othman_year5" },
//         { name: "ABDELRAHMEN DRIDI", class: "Year 6", year: "Year 6", id: "abdelrahmen_dridi_year6" },
//         { name: "ADAM KENZ", class: "Year 7", year: "Year 7", id: "adam_kenz_year7" },
//         { name: "AHMET EMRE DUZCU", class: "Year 8", year: "Year 8", id: "ahmet_emre_duzcu_year8" },
//         { name: "ABDULLAH ADEM TURAN", class: "Year 9", year: "Year 9", id: "abdullah_adem_turan_year9" }
//     ];

//     updateStudentCount();
//     renderStudentList();
//     updateYearFilterButtons();
//     showToast('Using cached/sample data', 'warning');
// }

// function cacheStudents(studentList) {
//     try {
//         const cacheData = {
//             students: studentList,
//             timestamp: Date.now()
//         };
//         localStorage.setItem(STUDENT_CACHE_KEY, JSON.stringify(cacheData));
//     } catch (e) {
//         console.warn('Failed to cache students:', e);
//     }
// }

// function getCachedStudents() {
//     try {
//         const cached = localStorage.getItem(STUDENT_CACHE_KEY);
//         if (!cached) return null;

//         const cacheData = JSON.parse(cached);
//         if (Date.now() - cacheData.timestamp > CACHE_EXPIRY) {
//             localStorage.removeItem(STUDENT_CACHE_KEY);
//             return null;
//         }
//         return cacheData.students;
//     } catch (e) {
//         return null;
//     }
// }

// function updateLoadingUI(isLoading) {
//     const studentListElement = document.getElementById('student-list');
//     if (!studentListElement) return;
//     if (isLoading) {
//         studentListElement.innerHTML = `
//             <li class="empty-state">
//                 <div class="loading" style="width: 40px; height: 40px; margin-bottom: 20px;"></div>
//                 <h3>Loading Students...</h3>
//                 <p>Please wait while we load the student database</p>
//             </li>
//         `;
//     }
// }

// // ==================== TEACHER PANEL ====================

// function updateYearFilterButtons() {
//     const filterContainer = document.getElementById('teacher-filters');
//     if (!filterContainer) return;

//     const uniqueYears = [...new Set(students.map(student => student.year))].sort((a, b) => {
//         const aIsYear = a.includes('Year');
//         const bIsYear = b.includes('Year');
//         const aIsKG = a.includes('KG');
//         const bIsKG = b.includes('KG');

//         if (aIsKG && bIsKG) return a.localeCompare(b);
//         if (aIsKG) return -1;
//         if (bIsKG) return 1;
//         if (aIsYear && bIsYear) {
//             const aNum = parseInt(a.replace(/\D/g, ''));
//             const bNum = parseInt(b.replace(/\D/g, ''));
//             return aNum - bNum;
//         }
//         return 0;
//     });

//     const yearCounts = {};
//     allPendingPickups.forEach(([_, pickup]) => {
//         const year = pickup.year || extractYearFromClassName(pickup.class);
//         yearCounts[year] = (yearCounts[year] || 0) + 1;
//     });

//     filterContainer.innerHTML = `
//         <button class="filter-btn ${currentYearFilter === 'all' ? 'active' : ''}" data-year="all">
//             All Students (${allPendingPickups.length})
//         </button>
//         ${uniqueYears.map(year => `
//             <button class="filter-btn ${currentYearFilter === year ? 'active' : ''}" data-year="${year}">
//                 ${getYearDisplayName(year)} (${yearCounts[year] || 0})
//             </button>
//         `).join('')}
//     `;

//     filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
//         btn.addEventListener('click', () => {
//             currentYearFilter = btn.dataset.year;
//             filterContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
//             btn.classList.add('active');
//             renderFilteredPendingList();
//         });
//     });
// }

// function setupPendingPickupsListener() {
//     const pendingRef = ref(db, 'pendingPickups');

//     onValue(pendingRef, (snapshot) => {
//         const pendingListElement = document.getElementById('pending-list');
//         if (!pendingListElement) return;

//         const data = snapshot.val();
//         allPendingPickups = data ? Object.entries(data) : [];

//         const pendingStudentNames = new Set();
//         allPendingPickups.forEach(([_, pickup]) => {
//             pendingStudentNames.add(pickup.name);
//         });

//         disabledStudentButtons.forEach(studentName => {
//             if (!pendingStudentNames.has(studentName)) {
//                 disabledStudentButtons.delete(studentName);
//             }
//         });

//         updatePendingCount();
//         updateYearFilterButtons();
//         renderFilteredPendingList();
//         renderStudentList(document.getElementById('student-search')?.value || '');

//         document.getElementById('active-pickups').textContent = allPendingPickups.length;
//     });
// }

// function renderFilteredPendingList() {
//     const pendingListElement = document.getElementById('pending-list');
//     if (!pendingListElement) return;

//     let filteredPickups = allPendingPickups;

//     if (currentYearFilter !== 'all') {
//         filteredPickups = allPendingPickups.filter(([_, pickup]) => {
//             const pickupYear = pickup.year || extractYearFromClassName(pickup.class);
//             return pickupYear === currentYearFilter;
//         });
//     }

//     if (filteredPickups.length === 0) {
//         pendingListElement.innerHTML = `
//             <li class="empty-state">
//                 <i class="fas fa-check-circle"></i>
//                 <h3>No Pending Pickups</h3>
//                 <p>${currentYearFilter !== 'all' ? `No pickups for ${getYearDisplayName(currentYearFilter)}` : 'When parents arrive, they\'ll appear here'}</p>
//             </li>
//         `;
//         return;
//     }

//     filteredPickups.sort((a, b) => a[1].timestamp - b[1].timestamp);
//     pendingListElement.innerHTML = '';

//     filteredPickups.forEach(([key, pickup]) => {
//         const waitTime = pickup.timestamp ?
//             Math.max(1, Math.round((Date.now() - pickup.timestamp) / 60000)) : 1;

//         const li = document.createElement('li');
//         li.className = 'list-item pending';
//         li.innerHTML = `
//             <div class="student-info">
//                 <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
//                     <div>
//                         <div class="student-name">${pickup.name}</div>
//                         <div style="margin-top: 5px;">
//                             <span class="student-class">${pickup.class}</span>
//                             <span class="wait-time">${waitTime} min waiting</span>
//                         </div>
//                     </div>
//                 </div>
//                 <div class="arrival-time">
//                     <i class="far fa-clock"></i>
//                     Arrived: ${pickup.arrivedAt || 'Just now'}
//                 </div>
//             </div>
//             <button class="btn btn-danger release-btn" data-key="${key}">
//                 <i class="fas fa-user-check"></i>
//                 Release
//             </button>
//         `;

//         li.querySelector('.release-btn').addEventListener('click', (e) => {
//             e.stopPropagation();
//             showReleaseConfirmation(key, pickup);
//         });

//         pendingListElement.appendChild(li);
//     });
// }

// // ==================== RELEASED LIST ====================

// function setupReleasedPickupsListener() {
//     const releasedRef = ref(db, 'releasedPickups');

//     onValue(releasedRef, (snapshot) => {
//         const releasedListElement = document.getElementById('released-list');
//         if (!releasedListElement) return;

//         const data = snapshot.val();
//         const releasedPickups = data ? Object.entries(data) : [];

//         if (releasedPickups.length === 0) {
//             releasedListElement.innerHTML = `
//                 <li class="empty-state">
//                     <i class="fas fa-history"></i>
//                     <h3>No Released Students</h3>
//                     <p>Students released today will appear here</p>
//                 </li>
//             `;
//             return;
//         }

//         // Sort by release time (most recent first)
//         releasedPickups.sort((a, b) => b[1].releasedAt - a[1].releasedAt);
//         releasedListElement.innerHTML = '';

//         releasedPickups.forEach(([key, pickup]) => {
//             const releaseTime = pickup.releasedTime || 
//                 new Date(pickup.releasedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

//             const li = document.createElement('li');
//             li.className = 'list-item released';
//             li.innerHTML = `
//                 <div class="student-info">
//                     <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
//                         <div>
//                             <div class="student-name">${pickup.name}</div>
//                             <div style="margin-top: 5px;">
//                                 <span class="student-class released-class">${pickup.class}</span>
//                                 <span class="released-time">Released</span>
//                             </div>
//                         </div>
//                     </div>
//                     <div class="arrival-time">
//                         <i class="fas fa-check-circle" style="color: var(--success);"></i>
//                         Released: ${releaseTime}
//                     </div>
//                 </div>
//             `;

//             releasedListElement.appendChild(li);
//         });
//     });
// }

// // ==================== UNDO FUNCTION ====================

// async function undoMarkParent(studentName, buttonElement) {
//     console.log('Undoing parent mark for:', studentName);

//     try {
//         // Find and delete from Firebase
//         const pendingRef = ref(db, 'pendingPickups');
//         const snapshot = await get(pendingRef);

//         if (snapshot.exists()) {
//             const pendingPickups = snapshot.val();
//             let foundKey = null;

//             for (const key in pendingPickups) {
//                 if (pendingPickups[key].name === studentName) {
//                     foundKey = key;
//                     break;
//                 }
//             }

//             if (foundKey) {
//                 await remove(ref(db, `pendingPickups/${foundKey}`));
//                 console.log(`🗑️ Removed ${studentName} from pending`);
//             }
//         }

//         // Re-enable the original button
//         if (buttonElement) {
//             buttonElement.disabled = false;
//             buttonElement.style.opacity = '1';
//             buttonElement.style.cursor = 'pointer';
//             buttonElement.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-dark))';
//             buttonElement.innerHTML = '<i class="fas fa-user-check"></i> Parent Here';
//             buttonElement.style.minWidth = '160px';
//         }

//         // Remove from disabled set so student reappears in Admin Panel
//         disabledStudentButtons.delete(studentName);

//         // Show success message
//         showToast(`↩️ Undo successful - ${studentName} removed`, 'success');

//         // Re-render to update UI
//         renderStudentList(document.getElementById('student-search')?.value || '');

//     } catch (error) {
//         console.error('Error undoing:', error);
//         showToast('Error: Could not undo', 'error');
//     }
// }

// // ==================== ADMIN PANEL ====================

// async function isStudentAlreadyPending(studentName) {
//     try {
//         const pendingRef = ref(db, 'pendingPickups');
//         const snapshot = await get(pendingRef);
//         if (!snapshot.exists()) return false;

//         const pendingPickups = snapshot.val();
//         for (const key in pendingPickups) {
//             if (pendingPickups[key].name === studentName) {
//                 return { isPending: true, key: key, data: pendingPickups[key] };
//             }
//         }
//         return false;
//     } catch (error) {
//         console.error('Error checking pending status:', error);
//         return false;
//     }
// }

// async function markParentArrived(student, buttonElement) {
//     console.log('Marking parent for:', student.name);

//     if (buttonElement) {
//         buttonElement.disabled = true;
//         buttonElement.style.opacity = '0.5';
//         buttonElement.style.cursor = 'not-allowed';
//         buttonElement.innerHTML = '<i class="fas fa-clock"></i> Waiting for Release...';
//     }

//     disabledStudentButtons.add(student.name);

//     const now = Date.now();
//     const lastClick = clickCooldown.get(student.name);

//     if (lastClick && (now - lastClick < COOLDOWN_TIME)) {
//         showToast(`Please wait a few seconds before marking ${student.name} again`, 'warning');
//         return;
//     }

//     clickCooldown.set(student.name, now);

//     const existingPickup = await isStudentAlreadyPending(student.name);

//     if (existingPickup) {
//         const waitTime = Math.round((Date.now() - existingPickup.data.timestamp) / 60000);
//         showToast(`❌ ${student.name} is already waiting (${waitTime} minutes)`, 'warning');
//         return;
//     }

//     try {
//         const pendingRef = ref(db, 'pendingPickups');
//         const newPickupRef = push(pendingRef);

//         const pickupData = {
//             name: student.name,
//             class: student.class,
//             year: student.year,
//             studentId: student.id,
//             timestamp: Date.now(),
//             arrivedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
//             markedBy: 'admin',
//             status: 'waiting'
//         };

//         await set(newPickupRef, pickupData);
//         console.log('Parent marked successfully:', pickupData);

//         showToast(`✅ ${student.name} marked for pickup!`, 'success');
//         playNotificationSound();

//         updatePendingCount();
//         setTimeout(() => updatePendingCount(), 1000);

//     } catch (error) {
//         console.error('Error marking parent arrived:', error);
//         showToast('Error: Could not mark parent arrived', 'error');

//         if (buttonElement) {
//             buttonElement.disabled = false;
//             buttonElement.style.opacity = '1';
//             buttonElement.style.cursor = 'pointer';
//             buttonElement.innerHTML = '<i class="fas fa-user-check"></i> Parent Here';
//         }
//         disabledStudentButtons.delete(student.name);
//     }
// }

// // ==================== STUDENT RENDERING WITH UNDO BUTTON ====================

// function renderStudentList(filter = '') {
//     const studentListElement = document.getElementById('student-list');
//     if (!studentListElement) return;

//     if (isLoadingStudents) {
//         updateLoadingUI(true);
//         return;
//     }

//     studentListElement.innerHTML = '';

//     // Filter students - hide those who have been released today
//     let filteredStudents = students.filter(student => !releasedStudentsToday.has(student.name));

//     if (filter) {
//         const searchTerm = filter.toLowerCase();
//         filteredStudents = filteredStudents.filter(student =>
//             student.name.toLowerCase().includes(searchTerm) ||
//             student.class.toLowerCase().includes(searchTerm) ||
//             student.year.toLowerCase().includes(searchTerm)
//         );
//     }

//     if (filteredStudents.length === 0) {
//         studentListElement.innerHTML = `
//             <li class="empty-state">
//                 <i class="fas fa-users"></i>
//                 <h3>No students available</h3>
//                 <p>${releasedStudentsToday.size > 0 ? 'All students have been released today' : 'Try a different search term'}</p>
//             </li>
//         `;
//         return;
//     }

//     // Group students by year
//     const groupedStudents = {};
//     filteredStudents.forEach(student => {
//         const year = student.year;
//         if (!groupedStudents[year]) {
//             groupedStudents[year] = [];
//         }
//         groupedStudents[year].push(student);
//     });

//     // Sort years
//     const sortedYears = Object.keys(groupedStudents).sort((a, b) => {
//         const aIsYear = a.includes('Year');
//         const bIsYear = b.includes('Year');
//         const aIsKG = a.includes('KG');
//         const bIsKG = b.includes('KG');

//         if (aIsKG && bIsKG) return a.localeCompare(b);
//         if (aIsKG) return -1;
//         if (bIsKG) return 1;
//         if (aIsYear && bIsYear) {
//             const aNum = parseInt(a.replace(/\D/g, ''));
//             const bNum = parseInt(b.replace(/\D/g, ''));
//             return aNum - bNum;
//         }
//         return 0;
//     });

//     const fragment = document.createDocumentFragment();

//     // Search result summary
//     if (filter) {
//         const summaryLi = document.createElement('li');
//         summaryLi.className = 'list-item';
//         summaryLi.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
//         summaryLi.style.color = 'white';
//         summaryLi.style.border = 'none';
//         summaryLi.style.marginBottom = '20px';
//         summaryLi.innerHTML = `
//             <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
//                 <div style="display: flex; align-items: center; gap: 10px;">
//                     <i class="fas fa-search" style="font-size: 1.2rem;"></i>
//                     <span style="font-weight: 600;">Found ${filteredStudents.length} student${filteredStudents.length > 1 ? 's' : ''}</span>
//                 </div>
//                 <span style="background: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 20px; font-size: 0.9rem;">
//                     "${filter}"
//                 </span>
//             </div>
//         `;
//         fragment.appendChild(summaryLi);
//     }

//     // Render students grouped by year
//     sortedYears.forEach(year => {
//         const yearStudents = groupedStudents[year];

//         // Year header
//         const yearHeader = document.createElement('li');
//         yearHeader.className = 'list-item';
//         yearHeader.style.background = 'var(--light)';
//         yearHeader.style.border = 'none';
//         yearHeader.style.borderLeft = `6px solid ${getYearColor(year)}`;
//         yearHeader.style.marginTop = '15px';
//         yearHeader.style.marginBottom = '10px';
//         yearHeader.style.padding = '12px 20px';
//         yearHeader.innerHTML = `
//             <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
//                 <div style="display: flex; align-items: center; gap: 10px;">
//                     <i class="fas ${getYearIcon(year)}" style="color: ${getYearColor(year)}; font-size: 1.2rem;"></i>
//                     <span style="font-weight: 700; font-size: 1.1rem; color: var(--dark);">${getYearDisplayName(year)}</span>
//                 </div>
//                 <span style="background: white; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; color: ${getYearColor(year)};">
//                     ${yearStudents.length} Student${yearStudents.length > 1 ? 's' : ''}
//                 </span>
//             </div>
//         `;
//         fragment.appendChild(yearHeader);

//         // Students in this year
//         yearStudents.forEach(student => {
//             const li = document.createElement('li');
//             li.className = 'list-item';

//             const isButtonDisabled = disabledStudentButtons.has(student.name);
//             const isPending = allPendingPickups.some(([_, pickup]) => pickup.name === student.name);

//             if (isPending && !disabledStudentButtons.has(student.name)) {
//                 disabledStudentButtons.add(student.name);
//             }

//             // Create the buttons container
//             const buttonsContainer = document.createElement('div');
//             buttonsContainer.style.display = 'flex';
//             buttonsContainer.style.gap = '8px';
//             buttonsContainer.style.alignItems = 'center';

//             // Main action button (Parent Here or Waiting)
//             const actionButton = document.createElement('button');
//             actionButton.className = `btn ${isPending || isButtonDisabled ? 'btn-secondary' : 'btn-primary'}`;
//             actionButton.setAttribute('data-student-id', student.id);
//             actionButton.setAttribute('data-student-name', student.name);
//             if (isPending || isButtonDisabled) {
//                 actionButton.disabled = true;
//                 actionButton.style.opacity = '0.7';
//                 actionButton.style.cursor = 'not-allowed';
//                 actionButton.style.background = 'var(--gray)';
//                 actionButton.style.minWidth = '160px';
//                 actionButton.innerHTML = '<i class="fas fa-clock"></i> Waiting for Release';
//             } else {
//                 actionButton.style.minWidth = '160px';
//                 actionButton.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-dark))';
//                 actionButton.innerHTML = '<i class="fas fa-user-check"></i> Parent Here';
//             }

//             // UNDO button - ONLY show if student is pending
//             if (isPending) {
//                 const undoButton = document.createElement('button');
//                 undoButton.className = 'btn';
//                 undoButton.style.background = '#ef4444';
//                 undoButton.style.color = 'white';
//                 undoButton.style.minWidth = '80px';
//                 undoButton.style.padding = '8px 12px';
//                 undoButton.style.fontSize = '0.8rem';
//                 undoButton.style.fontWeight = '600';
//                 undoButton.style.border = 'none';
//                 undoButton.style.borderRadius = '8px';
//                 undoButton.style.cursor = 'pointer';
//                 undoButton.style.display = 'flex';
//                 undoButton.style.alignItems = 'center';
//                 undoButton.style.gap = '6px';
//                 undoButton.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.3)';
//                 undoButton.innerHTML = '<i class="fas fa-undo-alt"></i> UNDO';

//                 undoButton.addEventListener('click', async (e) => {
//                     e.preventDefault();
//                     e.stopPropagation();
//                     await undoMarkParent(student.name, actionButton);
//                 });

//                 buttonsContainer.appendChild(undoButton);
//                 buttonsContainer.appendChild(actionButton);
//             } else {
//                 buttonsContainer.appendChild(actionButton);
//             }

//             // Student info div
//             const studentInfoDiv = document.createElement('div');
//             studentInfoDiv.className = 'student-info';
//             studentInfoDiv.innerHTML = `
//                 <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
//                     <div style="width: 40px; height: 40px; border-radius: 50%; background: ${getYearColor(student.year)}20; display: flex; align-items: center; justify-content: center;">
//                         <i class="fas fa-user-graduate" style="color: ${getYearColor(student.year)}; font-size: 1.1rem;"></i>
//                     </div>
//                     <div>
//                         <div class="student-name" style="font-size: 1.2rem; font-weight: 600; color: var(--dark);">
//                             ${student.name}
//                         </div>
//                         <div style="display: flex; gap: 8px; align-items: center;">
//                             <span class="student-class" style="background: ${getYearColor(student.year)}; padding: 4px 12px; border-radius: 20px; color: white; font-size: 0.8rem; font-weight: 600;">
//                                 ${student.class}
//                             </span>
//                             ${isPending ? `
//                                 <span style="display: flex; align-items: center; gap: 4px; color: #dc2626; font-size: 0.8rem; font-weight: 600;">
//                                     <i class="fas fa-exclamation-circle"></i>
//                                     Waiting
//                                 </span>
//                             ` : ''}
//                         </div>
//                     </div>
//                 </div>
//             `;

//             li.appendChild(studentInfoDiv);
//             li.appendChild(buttonsContainer);

//             // Add click event for Parent Here button if not disabled
//             if (!isPending && !isButtonDisabled) {
//                 actionButton.addEventListener('click', async (e) => {
//                     e.preventDefault();
//                     e.stopPropagation();

//                     if (actionButton.disabled) return;

//                     const now = Date.now();
//                     const lastClick = clickCooldown.get(student.name);

//                     if (lastClick && (now - lastClick < COOLDOWN_TIME)) {
//                         const secondsLeft = Math.ceil((COOLDOWN_TIME - (now - lastClick)) / 1000);
//                         showToast(`Wait ${secondsLeft}s before clicking again`, 'warning');
//                         return;
//                     }

//                     const existingPickup = await isStudentAlreadyPending(student.name);
//                     if (existingPickup) {
//                         const waitTime = Math.round((Date.now() - existingPickup.data.timestamp) / 60000);
//                         showToast(`❌ ${student.name} is already waiting (${waitTime} minutes)`, 'warning');

//                         disabledStudentButtons.add(student.name);
//                         actionButton.disabled = true;
//                         actionButton.style.opacity = '0.7';
//                         actionButton.style.cursor = 'not-allowed';
//                         actionButton.innerHTML = '<i class="fas fa-clock"></i> Waiting for Release';
//                         return;
//                     }

//                     await markParentArrived(student, actionButton);
//                 });
//             }

//             fragment.appendChild(li);
//         });
//     });

//     studentListElement.appendChild(fragment);
// }

// // Helper functions for visual styling
// function getYearColor(year) {
//     if (year.includes('KG')) return '#f59e0b';
//     if (year.includes('Year')) {
//         const yearNum = parseInt(year.replace(/\D/g, ''));
//         const colors = [
//             '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#ef4444',
//             '#14b8a6', '#f97316', '#6366f1', '#6b7280'
//         ];
//         return colors[yearNum - 1] || '#64748b';
//     }
//     return '#64748b';
// }

// function getYearIcon(year) {
//     if (year.includes('KG')) return 'fa-child';
//     if (year.includes('Year')) {
//         const yearNum = parseInt(year.replace(/\D/g, ''));
//         const icons = [
//             'fa-star', 'fa-rocket', 'fa-flask', 'fa-book', 'fa-globe',
//             'fa-calculator', 'fa-flask', 'fa-music', 'fa-graduation-cap'
//         ];
//         return icons[yearNum - 1] || 'fa-user-graduate';
//     }
//     return 'fa-user-graduate';
// }

// // ==================== CONFIRMATION DIALOG ====================

// let pendingReleaseKey = null;
// let pendingReleaseData = null;

// function showReleaseConfirmation(key, pickupData) {
//     pendingReleaseKey = key;
//     pendingReleaseData = pickupData;

//     const waitTime = pickupData.timestamp ?
//         Math.max(1, Math.round((Date.now() - pickupData.timestamp) / 60000)) : 1;

//     document.getElementById('confirm-student-name').textContent = pickupData.name;
//     document.getElementById('confirm-student-class').textContent = pickupData.class;
//     document.getElementById('confirm-wait-time').textContent = `${waitTime} minutes`;
//     document.getElementById('confirm-arrival-time').textContent = pickupData.arrivedAt || 'Unknown';

//     const modal = document.getElementById('confirmation-modal');
//     modal.style.display = 'flex';
//     document.getElementById('confirm-cancel').focus();
// }

// function setupConfirmationDialog() {
//     const modal = document.getElementById('confirmation-modal');
//     const cancelBtn = document.getElementById('confirm-cancel');
//     const confirmBtn = document.getElementById('confirm-release');

//     cancelBtn.addEventListener('click', () => {
//         modal.style.display = 'none';
//         pendingReleaseKey = null;
//         pendingReleaseData = null;
//     });

//     confirmBtn.addEventListener('click', async () => {
//         if (pendingReleaseKey && pendingReleaseData) {
//             modal.style.display = 'none';
//             await releaseStudent(pendingReleaseKey, pendingReleaseData.name);
//             pendingReleaseKey = null;
//             pendingReleaseData = null;
//         }
//     });

//     document.addEventListener('keydown', (e) => {
//         if (e.key === 'Escape' && modal.style.display === 'flex') {
//             modal.style.display = 'none';
//             pendingReleaseKey = null;
//             pendingReleaseData = null;
//         }
//     });

//     modal.addEventListener('click', (e) => {
//         if (e.target === modal) {
//             modal.style.display = 'none';
//             pendingReleaseKey = null;
//             pendingReleaseData = null;
//         }
//     });
// }

// async function releaseStudent(key, studentName) {
//     console.log('Releasing student:', studentName);

//     try {
//         const pickupRef = ref(db, `pendingPickups/${key}`);
//         const snapshot = await get(pickupRef);

//         if (snapshot.exists()) {
//             const pickupData = snapshot.val();

//             pickupData.releasedAt = Date.now();
//             pickupData.releasedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
//             pickupData.releasedBy = 'teacher';

//             const releasedRef = ref(db, `releasedPickups/${key}`);
//             await set(releasedRef, pickupData);
//             await remove(pickupRef);

//             // Add to released students set (so they stay hidden from Admin Panel)
//             releasedStudentsToday.add(studentName);

//             // Remove from disabled set so button resets
//             disabledStudentButtons.delete(studentName);

//             // Force re-render of Admin Panel to hide the released student
//             const searchInput = document.getElementById('student-search');
//             renderStudentList(searchInput?.value || '');

//             showToast(`✅ ${studentName} released safely!`, 'success');
//             updateReleasedCount();

//         } else {
//             showToast('Error: Pickup not found', 'error');
//         }

//     } catch (error) {
//         console.error('Error releasing student:', error);
//         showToast('Error releasing student', 'error');
//     }
// }

// // ==================== NOTIFICATIONS ====================

// function setupNotifications() {
//     const requestNotifBtn = document.getElementById('request-notif');
//     const notificationStatus = document.getElementById('notification-status');

//     if (!requestNotifBtn || !notificationStatus) return;

//     if (Notification.permission === 'granted') {
//         requestNotifBtn.innerHTML = '<i class="fas fa-bell"></i> Notifications Enabled';
//         requestNotifBtn.disabled = true;
//         notificationStatus.textContent = '✅ Notifications are enabled';
//         notificationStatus.style.color = 'var(--secondary)';
//     }

//     requestNotifBtn.addEventListener('click', async () => {
//         try {
//             const permission = await Notification.requestPermission();

//             if (permission === 'granted') {
//                 const token = await getToken(messaging, {
//                     vapidKey: 'BFkDcJvK7xDqpvHlUws0fXHaXpI2qU9hww-SFXtNSE55kmE-YwksroR58RY1jPecKsijY26r0yATiS21dLdNB6A'
//                 });

//                 console.log('FCM Token:', token);
//                 localStorage.setItem('fcmToken', token);

//                 requestNotifBtn.innerHTML = '<i class="fas fa-bell"></i> Notifications Enabled';
//                 requestNotifBtn.disabled = true;
//                 notificationStatus.textContent = '✅ Notifications are enabled';
//                 notificationStatus.style.color = 'var(--secondary)';

//                 showToast('Notifications enabled!', 'success');

//             } else {
//                 notificationStatus.textContent = '❌ Notifications blocked';
//                 notificationStatus.style.color = 'var(--danger)';
//                 showToast('Notifications permission denied', 'warning');
//             }

//         } catch (err) {
//             console.error('Notification setup failed:', err);
//             showToast('Error enabling notifications', 'error');
//         }
//     });

//     onMessage(messaging, (payload) => {
//         if (payload.notification) {
//             const { title, body } = payload.notification;
//             showToast(`${title}: ${body}`, 'info');
//             playNotificationSound();
//         }
//     });
// }

// // ==================== UTILITY FUNCTIONS ====================

// function showToast(message, type = 'info', duration = 5000) {
//     const icons = {
//         success: 'fas fa-check-circle',
//         warning: 'fas fa-exclamation-triangle',
//         error: 'fas fa-times-circle',
//         info: 'fas fa-info-circle'
//     };

//     const toast = document.createElement('div');
//     toast.className = `toast ${type}`;
//     toast.innerHTML = `
//         <i class="${icons[type] || icons.info} toast-icon"></i>
//         <div class="toast-content">${message}</div>
//         <button class="toast-close" onclick="this.parentElement.remove()">
//             <i class="fas fa-times"></i>
//         </button>
//     `;

//     const container = document.getElementById('toast-container');
//     if (container) {
//         container.appendChild(toast);
//         setTimeout(() => {
//             if (toast.parentElement) toast.remove();
//         }, duration);
//     }
// }

// function playNotificationSound() {
//     try {
//         const audioContext = new (window.AudioContext || window.webkitAudioContext)();
//         const oscillator = audioContext.createOscillator();
//         const gainNode = audioContext.createGain();

//         oscillator.connect(gainNode);
//         gainNode.connect(audioContext.destination);

//         oscillator.frequency.value = 800;
//         oscillator.type = 'sine';
//         gainNode.gain.value = 0.1;

//         oscillator.start();
//         setTimeout(() => oscillator.stop(), 200);

//     } catch (e) {
//         console.log('Sound not available');
//     }
// }

// function updateStudentCount() {
//     const totalStudentsElement = document.getElementById('total-students');
//     if (totalStudentsElement) {
//         totalStudentsElement.textContent = students.length;
//     }
// }

// async function updatePendingCount() {
//     try {
//         const pendingRef = ref(db, 'pendingPickups');
//         const snapshot = await get(pendingRef);
//         const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;

//         ['pending-count', 'active-pickups'].forEach(id => {
//             const element = document.getElementById(id);
//             if (element) element.textContent = count;
//         });

//     } catch (error) {
//         console.error('Error updating pending count:', error);
//     }
// }

// async function updateReleasedCount() {
//     try {
//         const releasedRef = ref(db, 'releasedPickups');
//         const snapshot = await get(releasedRef);
//         const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;

//         const releasedElement = document.getElementById('released-today');
//         if (releasedElement) releasedElement.textContent = count;

//     } catch (error) {
//         console.error('Error updating released count:', error);
//     }
// }

// function cleanupClickCooldown() {
//     const now = Date.now();
//     for (const [studentName, timestamp] of clickCooldown.entries()) {
//         if (now - timestamp > COOLDOWN_TIME * 10) {
//             clickCooldown.delete(studentName);
//         }
//     }
// }

// let searchTimeout = null;
// function setupSearch() {
//     const searchInput = document.getElementById('student-search');
//     if (!searchInput) return;

//     searchInput.addEventListener('input', (e) => {
//         if (searchTimeout) clearTimeout(searchTimeout);

//         searchTimeout = setTimeout(() => {
//             renderStudentList(e.target.value);
//         }, 300);
//     });

//     searchInput.placeholder = '🔍 Search by student name, class, or year...';
// }

// // ==================== FORCE RESET BUTTON ====================

// window.forceResetForNewDay = async function() {
//     if (confirm('Are you sure you want to reset the system for a new day? This will archive all current pickups.')) {
//         await resetSystemForNewDay();
//         showToast('System reset complete!', 'success');
//     }
// };

// // ==================== INITIALIZATION ====================

// document.addEventListener('DOMContentLoaded', () => {
//     console.log('DOM loaded, initializing app with CORRECT RELEASE LOGIC...');

//     checkAndResetForNewDay().catch(console.error);
//     loadStudentsFromCSV().catch(console.error);

//     setTimeout(() => {
//         setupPendingPickupsListener();
//         setupReleasedPickupsListener();
//         setupConfirmationDialog();
//         setupSearch();

//         updatePendingCount();
//         updateReleasedCount();

//         setInterval(cleanupClickCooldown, 60000);
//         setInterval(checkAndResetForNewDay, 60 * 60 * 1000);

//         console.log('App initialized - Student stays HIDDEN after release!');
//     }, 100);
// });

// function updateOnlineStatus() {
//     const isOnline = navigator.onLine;
//     if (!isOnline) {
//         showToast('You are offline. Data may not sync.', 'warning');
//     }
// }

// window.addEventListener('online', updateOnlineStatus);
// window.addEventListener('offline', updateOnlineStatus);

// window.renderStudentList = renderStudentList;
// window.students = students;
// window.clearStudentCache = () => {
//     localStorage.removeItem(STUDENT_CACHE_KEY);
//     studentLoadPromise = null;
//     loadStudentsFromCSV();
// };

// console.log('✅ App loaded - Students stay hidden in Admin Panel after release!');
// app.js - COMPLETE WORKING VERSION (NO ERRORS)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getDatabase, ref, push, set, onValue, remove, get } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyCAai2enHwfyrxcBpu556rtKSw9sjtyAno",
    authDomain: "tunis-school-dismissal.firebaseapp.com",
    projectId: "tunis-school-dismissal",
    storageBucket: "tunis-school-dismissal.firebasestorage.app",
    messagingSenderId: "490622758126",
    appId: "1:490622758126:web:54221213cd1c2c5e2657ff",
    measurementId: "G-0H39R6ESX0",
    databaseURL: "https://tunis-school-dismissal-default-rtdb.europe-west1.firebasedatabase.app/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ==================== STUDENTS ARRAY ====================
const STUDENTS = [
    { name: "AILA ALLA", class: "KG1", year: "KG1" },
    { name: "ALI ILBEY ZOR", class: "KG1", year: "KG1" },
    { name: "ESMA SERT", class: "KG1", year: "KG1" },
    { name: "LIYA MAYAN KAYA", class: "KG1", year: "KG1" },
    { name: "RAKAN HAMROUNI", class: "KG1", year: "KG1" },
    { name: "AMIN OSMAN", class: "kg2", year: "KG2" },
    { name: "CHAHINE BEN AMOR", class: "kg2", year: "KG2" },
    { name: "KAMAR TARHOUNI", class: "kg2", year: "KG2" },
    { name: "NIBRAS KARJIKAR", class: "kg2", year: "KG2" },
    { name: "RAKAN ELBAKBAK", class: "kg2", year: "KG2" },
    { name: "ROUMAYSA ARWA", class: "kg2", year: "KG2" },
    { name: "SOFIA MEFTEH", class: "kg2", year: "KG2" },
    { name: "YOSSEF ALLA NUSEIR", class: "kg2", year: "KG2" },
    { name: "ZEYNEP ELA SERT", class: "kg2", year: "KG2" },
    { name: "MIKAIL HAKTAN", class: "kg2", year: "KG2" },
    { name: "AYLA ERDOGAN", class: "Year 1", year: "Year 1" },
    { name: "AZAM SHABEER", class: "Year 1", year: "Year 1" },
    { name: "EFE AYDOGDU", class: "Year 1", year: "Year 1" },
    { name: "ERVA OZDEMIR", class: "Year 1", year: "Year 1" },
    { name: "HUSSAM NUSEIR", class: "Year 1", year: "Year 1" },
    { name: "JULIA CHERNI", class: "Year 1", year: "Year 1" },
    { name: "LARA KAABI", class: "Year 1", year: "Year 1" },
    { name: "MIRAY DEMIR", class: "Year 1", year: "Year 1" },
    { name: "OMER MUSAB YAVUZTURK", class: "Year 1", year: "Year 1" },
    { name: "AWES AYARI", class: "Year 2", year: "Year 2" },
    { name: "FARES ALASWAD", class: "Year 2", year: "Year 2" },
    { name: "FIRDAOUS TURAN", class: "Year 2", year: "Year 2" },
    { name: "HASAN HUSSEYIN TEMEL", class: "Year 2", year: "Year 2" },
    { name: "ILEF SFAR", class: "Year 2", year: "Year 2" },
    { name: "KHADIJA ABUFALGHA", class: "Year 2", year: "Year 2" },
    { name: "LAYANA KATRAMIZ", class: "Year 2", year: "Year 2" },
    { name: "MOHAMED YESSINE NESSIB", class: "Year 2", year: "Year 2" },
    { name: "RAYEN HAMZAOUI", class: "Year 2", year: "Year 2" },
    { name: "SILA KHALIFA ELSHAWESH", class: "Year 2", year: "Year 2" },
    { name: "ADAM KHALIFA ELSHAWESH", class: "Year 3", year: "Year 3" },
    { name: "AICHA KENZ", class: "Year 3", year: "Year 3" },
    { name: "ANAYA HANEEN MAJID", class: "Year 3", year: "Year 3" },
    { name: "AYSE SERRA DEMIRCILER", class: "Year 3", year: "Year 3" },
    { name: "CEMAL SELIM KURNAZ", class: "Year 3", year: "Year 3" },
    { name: "ELISSA AOUADHI", class: "Year 3", year: "Year 3" },
    { name: "GHALIA HENTATI", class: "Year 3", year: "Year 3" },
    { name: "JAD EL OUNI", class: "Year 3", year: "Year 3" },
    { name: "KHADIJA JALLELI", class: "Year 3", year: "Year 3" },
    { name: "LUJAIN DRIDI", class: "Year 3", year: "Year 3" },
    { name: "MARWA LOUISE CHAMPON", class: "Year 3", year: "Year 3" },
    { name: "MUHAMMAD HASHIM BHATTI", class: "Year 3", year: "Year 3" },
    { name: "NARJES IBN EL AZZOUZI", class: "Year 3", year: "Year 3" },
    { name: "OMER DUZCU", class: "Year 3", year: "Year 3" },
    { name: "RACHED BEN KHATEM", class: "Year 3", year: "Year 3" },
    { name: "ROUDINA ARWA", class: "Year 3", year: "Year 3" },
    { name: "SARA SARAL", class: "Year 3", year: "Year 3" },
    { name: "SELIM DUKMEN", class: "Year 3", year: "Year 3" },
    { name: "YASMINA CHEKIR", class: "Year 3", year: "Year 3" },
    { name: "YOUSSEF KHADRA", class: "Year 3", year: "Year 3" },
    { name: "ZEYNEP MEKSI", class: "Year 3", year: "Year 3" },
    { name: "ZEYD SFAR", class: "Year 3", year: "Year 3" },
    { name: "BAYA MEFTEH", class: "Year 4", year: "Year 4" },
    { name: "BAYA AROUA", class: "Year 4", year: "Year 4" },
    { name: "DONIA HAKTAN", class: "Year 4", year: "Year 4" },
    { name: "GHANEM MAZROUAI", class: "Year 4", year: "Year 4" },
    { name: "MEHMET EYMEN KURNAZ", class: "Year 4", year: "Year 4" },
    { name: "MELIA KATRAMIZ", class: "Year 4", year: "Year 4" },
    { name: "MOHAMED ASAF TEMEL", class: "Year 4", year: "Year 4" },
    { name: "MOHAMED HANI TARHOUNI", class: "Year 4", year: "Year 4" },
    { name: "SANDRA JERBI", class: "Year 4", year: "Year 4" },
    { name: "YAHIA MAAFA", class: "Year 4", year: "Year 4" },
    { name: "ZAKARYA BEN AMAR", class: "Year 4", year: "Year 4" },
    { name: "AHMED KARIM OTHMAN", class: "Year 5", year: "Year 5" },
    { name: "ALI EYMEN YANMAZ", class: "Year 5", year: "Year 5" },
    { name: "ATHAULLAH ZAIDAN KURNIA", class: "Year 5", year: "Year 5" },
    { name: "BARAA NECHI", class: "Year 5", year: "Year 5" },
    { name: "CHARIF KZADRI", class: "Year 5", year: "Year 5" },
    { name: "GHALA ABOUKIM", class: "Year 5", year: "Year 5" },
    { name: "HALIMA JALLELI", class: "Year 5", year: "Year 5" },
    { name: "IPEK BELKIS TURAN", class: "Year 5", year: "Year 5" },
    { name: "IREM BAYAR", class: "Year 5", year: "Year 5" },
    { name: "KHALEEFA ARWA", class: "Year 5", year: "Year 5" },
    { name: "NOURANE DUKMEN", class: "Year 5", year: "Year 5" },
    { name: "YAGMUR RACHEL OZDEMIR", class: "Year 5", year: "Year 5" },
    { name: "YAZID IBN EL AZZOUZI", class: "Year 5", year: "Year 5" },
    { name: "ABDELRAHMEN DRIDI", class: "Year 6", year: "Year 6" },
    { name: "AYMEN OSMAN", class: "Year 6", year: "Year 6" },
    { name: "FATIMA SHABEER", class: "Year 6", year: "Year 6" },
    { name: "GHAZEL ABOUKIM", class: "Year 6", year: "Year 6" },
    { name: "MABROUK ABUFALGHA", class: "Year 6", year: "Year 6" },
    { name: "MALEK ALAHMAR", class: "Year 6", year: "Year 6" },
    { name: "MIRAL EL KHECHINE", class: "Year 6", year: "Year 6" },
    { name: "MOHAMED ALI SHABEER", class: "Year 6", year: "Year 6" },
    { name: "MOHAMED KINEN NECHI", class: "Year 6", year: "Year 6" },
    { name: "MUHAMMAD HASHIR BHATTI", class: "Year 6", year: "Year 6" },
    { name: "NADIA OUKHAI", class: "Year 6", year: "Year 6" },
    { name: "NAYA TALOUZI", class: "Year 6", year: "Year 6" },
    { name: "OMER FARUK DEMIRCILER", class: "Year 6", year: "Year 6" },
    { name: "SARA ALFADLEY", class: "Year 6", year: "Year 6" },
    { name: "SOFIA HENTATI", class: "Year 6", year: "Year 6" },
    { name: "YANIS TABOUBI", class: "Year 6", year: "Year 6" },
    { name: "ZEYNEP ARYA AKGEYIK", class: "Year 6", year: "Year 6" },
    { name: "ADAM KENZ", class: "Year 7", year: "Year 7" },
    { name: "ATHARIZZ ZAFRAN KURNIA", class: "Year 7", year: "Year 7" },
    { name: "AYA AGEEL", class: "Year 7", year: "Year 7" },
    { name: "EFE MERSIN", class: "Year 7", year: "Year 7" },
    { name: "EZED BOUDEN", class: "Year 7", year: "Year 7" },
    { name: "FATMA EZAHRA FEKIH", class: "Year 7", year: "Year 7" },
    { name: "LINA NESSIB", class: "Year 7", year: "Year 7" },
    { name: "MARIEM HAMZAOUI", class: "Year 7", year: "Year 7" },
    { name: "MILYA EL KHECHINE", class: "Year 7", year: "Year 7" },
    { name: "MIRAA MAZROUAI", class: "Year 7", year: "Year 7" },
    { name: "MISHAAL MAJID", class: "Year 7", year: "Year 7" },
    { name: "MOHAMED AGEEL", class: "Year 7", year: "Year 7" },
    { name: "MOHAMED SKANDER BAROUNI", class: "Year 7", year: "Year 7" },
    { name: "NERMIN TURAN", class: "Year 7", year: "Year 7" },
    { name: "NOURCHEN DUKMEN", class: "Year 7", year: "Year 7" },
    { name: "NOURHEN DUKMEN", class: "Year 7", year: "Year 7" },
    { name: "OMER BAYAR", class: "Year 7", year: "Year 7" },
    { name: "RAHSHED MAZROUAI", class: "Year 7", year: "Year 7" },
    { name: "SOULAYMEN HENTATI", class: "Year 7", year: "Year 7" },
    { name: "ZAKARIA HENTATI", class: "Year 7", year: "Year 7" },
    { name: "AHMET EMRE DUZCU", class: "Year 8", year: "Year 8" },
    { name: "AICHA BEN ZAIED", class: "Year 8", year: "Year 8" },
    { name: "CHAIMA CHIKHAOUI", class: "Year 8", year: "Year 8" },
    { name: "ESMA HAVVA KOCABEY", class: "Year 8", year: "Year 8" },
    { name: "FATMA CHIKHAOUI", class: "Year 8", year: "Year 8" },
    { name: "HAMAD MAZROUAI", class: "Year 8", year: "Year 8" },
    { name: "HILAL ZUMRA OZBEY", class: "Year 8", year: "Year 8" },
    { name: "ISMAIL ZAYATI", class: "Year 8", year: "Year 8" },
    { name: "IYED JALOULI", class: "Year 8", year: "Year 8" },
    { name: "MOHAMD ALI BAROUDI", class: "Year 8", year: "Year 8" },
    { name: "MOHAMED KZADRI", class: "Year 8", year: "Year 8" },
    { name: "NOUHA BOUYAHIA", class: "Year 8", year: "Year 8" },
    { name: "NOUR BOUYAHIA", class: "Year 8", year: "Year 8" },
    { name: "ROUKAYA MEHRI", class: "Year 8", year: "Year 8" },
    { name: "YAZAN BAROUDI", class: "Year 8", year: "Year 8" },
    { name: "ZAINEB JALLEI", class: "Year 8", year: "Year 8" },
    { name: "ZAYD LAMIRI", class: "Year 8", year: "Year 8" },
    { name: "ABDULLAH ADEM TURAN", class: "Year 9", year: "Year 9" },
    { name: "AHMED CHEKIR", class: "Year 9", year: "Year 9" },
    { name: "AICHA ELLOUZ", class: "Year 9", year: "Year 9" },
    { name: "AICHA KZADRI", class: "Year 9", year: "Year 9" },
    { name: "AMIR OUKHAI", class: "Year 9", year: "Year 9" },
    { name: "ASEEL MOHAMMED AMMAR ALAHMER", class: "Year 9", year: "Year 9" },
    { name: "DORRA DAFDOUF", class: "Year 9", year: "Year 9" },
    { name: "ELYES TABOUBI", class: "Year 9", year: "Year 9" },
    { name: "EYA OUERTANI", class: "Year 9", year: "Year 9" },
    { name: "INES BEN ZAIED", class: "Year 9", year: "Year 9" },
    { name: "MARIA HAMZAOUI", class: "Year 9", year: "Year 9" },
    { name: "MOHAMED YASSINE BARKAOUI", class: "Year 9", year: "Year 9" },
    { name: "NEVA DEMIRCAN", class: "Year 9", year: "Year 9" },
    { name: "ROUKAYA BEN OMRANE", class: "Year 9", year: "Year 9" },
    { name: "SAFIA DARGHOUTH", class: "Year 9", year: "Year 9" },
    { name: "SHADA MOHAMMED AMMAR ALAHMER", class: "Year 9", year: "Year 9" },
    { name: "TAYMA YASMINA KENZ", class: "Year 9", year: "Year 9" },
    { name: "WAJD HOUAICHINE", class: "Year 9", year: "Year 9" },
    { name: "YASSINE GUITOUNI", class: "Year 9", year: "Year 9" }
];

// ==================== STATE ====================
const RELEASED_MEMORY_KEY = 'maarif_released';
let currentYearFilter = 'all';
let allPendingPickups = [];
let releasedStudentsToday = new Set();
let disabledStudentButtons = new Set();
let pendingReleaseKey = null;
let pendingReleaseData = null;

// Load released from memory
try {
    const saved = localStorage.getItem(RELEASED_MEMORY_KEY);
    if (saved) releasedStudentsToday = new Set(JSON.parse(saved));
} catch (e) {}

// ==================== CONFIRMATION DIALOG FUNCTIONS ====================
function showReleaseConfirmation(key, data) {
    pendingReleaseKey = key;
    pendingReleaseData = data;

    // Find the pickup data
    const found = allPendingPickups.find(([k]) => k === key);
    let waitTime = 1;

    if (found && found[1] && found[1].timestamp) {
        waitTime = Math.max(1, Math.round((Date.now() - found[1].timestamp) / 60000));
    }

    document.getElementById('confirm-student-name').textContent = data.name;
    document.getElementById('confirm-student-class').textContent = data.class;
    document.getElementById('confirm-wait-time').textContent = waitTime + ' minutes';
    document.getElementById('confirm-arrival-time').textContent = data.arrivedAt || 'Unknown';

    document.getElementById('confirmation-modal').style.display = 'flex';
}

// Make function globally available
window.showReleaseConfirmation = showReleaseConfirmation;

function setupConfirmationDialog() {
    const modal = document.getElementById('confirmation-modal');
    const cancelBtn = document.getElementById('confirm-cancel');
    const confirmBtn = document.getElementById('confirm-release');

    cancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        pendingReleaseKey = null;
        pendingReleaseData = null;
    });

    confirmBtn.addEventListener('click', async() => {
        if (pendingReleaseKey && pendingReleaseData) {
            modal.style.display = 'none';
            await releaseStudent(pendingReleaseKey, pendingReleaseData.name);
            pendingReleaseKey = null;
            pendingReleaseData = null;
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
            pendingReleaseKey = null;
            pendingReleaseData = null;
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            pendingReleaseKey = null;
            pendingReleaseData = null;
        }
    });
}

// ==================== RENDER FUNCTIONS ====================
function renderStudentList() {
    const list = document.getElementById('student-list');
    if (!list) return;

    let filtered = STUDENTS.filter(s => !releasedStudentsToday.has(s.name));

    if (filtered.length === 0) {
        list.innerHTML = '<li class="empty-state"><i class="fas fa-users"></i><h3>No students available</h3></li>';
        return;
    }

    let html = '';
    const groups = {};
    filtered.forEach(s => {
        if (!groups[s.year]) groups[s.year] = [];
        groups[s.year].push(s);
    });

    const years = Object.keys(groups).sort();

    years.forEach(year => {
                html += `<li class="list-item" style="background:var(--light);border-left:6px solid #00aebc;margin-top:15px">
            <div style="display:flex;justify-content:space-between;width:100%">
                <span style="font-weight:700">${year}</span>
                <span>${groups[year].length}</span>
            </div>
        </li>`;

                groups[year].forEach(s => {
                            const isPending = allPendingPickups.some(([_, p]) => p.name === s.name);
                            html += `
                <li class="list-item">
                    <div class="student-info">
                        <div class="student-name">${s.name}</div>
                        <span class="student-class">${s.class}</span>
                        ${isPending ? '<span style="color:#dc2626"> Waiting</span>' : ''}
                    </div>
                    <div style="display:flex;gap:8px">
                        ${isPending ? `
                            <button class="btn" style="background:#ef4444;color:white" onclick="undoMarkParent('${s.name}')">
                                UNDO
                            </button>
                        ` : ''}
                        <button class="btn ${isPending ? 'btn-secondary' : 'btn-primary'}" 
                            ${isPending ? 'disabled' : ''}
                            onclick="markParentArrived('${s.name}', '${s.class}', '${s.year}')">
                            ${isPending ? 'Waiting' : 'Parent Here'}
                        </button>
                    </div>
                </li>
            `;
        });
    });
    
    list.innerHTML = html;
}

function renderFilteredPendingList() {
    const list = document.getElementById('pending-list');
    if (!list) return;

    if (allPendingPickups.length === 0) {
        list.innerHTML = '<li class="empty-state"><i class="fas fa-check-circle"></i><h3>No Pending Pickups</h3></li>';
        return;
    }

    let html = '';
    allPendingPickups.forEach(([key, p]) => {
        const waitTime = Math.max(1, Math.round((Date.now() - p.timestamp) / 60000));
        // Escape quotes for safe HTML
        const safeName = p.name.replace(/'/g, "\\'");
        const safeClass = p.class.replace(/'/g, "\\'");
        const safeArrived = p.arrivedAt ? p.arrivedAt.replace(/'/g, "\\'") : '';
        
        html += `
            <li class="list-item pending">
                <div class="student-info">
                    <div class="student-name">${p.name}</div>
                    <span class="student-class">${p.class}</span>
                    <span class="wait-time">${waitTime} min</span>
                    <div class="arrival-time"><i class="far fa-clock"></i> Arrived: ${p.arrivedAt || 'Just now'}</div>
                </div>
                <button class="btn btn-danger" onclick="showReleaseConfirmation('${key}', {name: '${safeName}', class: '${safeClass}', arrivedAt: '${safeArrived}'})">
                    Release
                </button>
            </li>
        `;
    });
    
    list.innerHTML = html;
}

function renderReleasedList(releasedPickups) {
    const list = document.getElementById('released-list');
    if (!list) return;
    
    if (releasedPickups.length === 0) {
        list.innerHTML = '<li class="empty-state"><i class="fas fa-history"></i><h3>No Released Students</h3></li>';
        return;
    }
    
    releasedPickups.sort((a, b) => b[1].releasedAt - a[1].releasedAt);
    let html = '';
    releasedPickups.forEach(([_, p]) => {
        const releaseTime = p.releasedTime || new Date(p.releasedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        html += `
            <li class="list-item released">
                <div class="student-info">
                    <div class="student-name">${p.name}</div>
                    <span class="student-class released-class">${p.class}</span>
                    <span class="released-time">Released</span>
                    <div class="arrival-time"><i class="fas fa-check-circle"></i> ${releaseTime}</div>
                </div>
            </li>
        `;
    });
    
    list.innerHTML = html;
}

function updateYearFilterButtons() {
    const container = document.getElementById('teacher-filters');
    if (!container) return;
    
    container.innerHTML = `
        <button class="filter-btn active" data-year="all">All (${allPendingPickups.length})</button>
    `;
}

// ==================== ACTIONS ====================
window.markParentArrived = async function(name, className, year) {
    try {
        await set(push(ref(db, 'pendingPickups')), {
            name, class: className, year,
            timestamp: Date.now(),
            arrivedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        showToast(`✅ ${name} marked`);
    } catch (error) {
        showToast('❌ Error', 'error');
    }
};

window.undoMarkParent = async function(name) {
    const pending = allPendingPickups.find(([_, p]) => p.name === name);
    if (pending) {
        await remove(ref(db, `pendingPickups/${pending[0]}`));
        showToast(`↩️ Undo ${name}`);
    }
};

async function releaseStudent(key, studentName) {
    try {
        const snapshot = await get(ref(db, `pendingPickups/${key}`));
        if (snapshot.exists()) {
            const data = snapshot.val();
            data.releasedAt = Date.now();
            data.releasedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            await set(ref(db, `releasedPickups/${key}`), data);
            await remove(ref(db, `pendingPickups/${key}`));
            
            releasedStudentsToday.add(studentName);
            localStorage.setItem(RELEASED_MEMORY_KEY, JSON.stringify([...releasedStudentsToday]));
            showToast(`✅ ${studentName} released`);
        }
    } catch (error) {
        showToast('❌ Error', 'error');
    }
}

// Make releaseStudent globally available
window.releaseStudent = releaseStudent;

// ==================== REALTIME LISTENERS ====================
onValue(ref(db, 'pendingPickups'), (snapshot) => {
    const data = snapshot.val();
    allPendingPickups = data ? Object.entries(data) : [];
    
    document.getElementById('active-pickups').textContent = allPendingPickups.length;
    document.getElementById('pending-count').textContent = allPendingPickups.length;
    
    renderFilteredPendingList();
    renderStudentList();
});

onValue(ref(db, 'releasedPickups'), (snapshot) => {
    const data = snapshot.val();
    const releasedPickups = data ? Object.entries(data) : [];
    
    document.getElementById('released-today').textContent = releasedPickups.length;
    
    releasedStudentsToday.clear();
    releasedPickups.forEach(([_, p]) => p.name && releasedStudentsToday.add(p.name));
    localStorage.setItem(RELEASED_MEMORY_KEY, JSON.stringify([...releasedStudentsToday]));
    
    renderStudentList();
    renderReleasedList(releasedPickups);
});

// ==================== UTILITIES ====================
function showToast(message, type = 'success', duration = 3000) {
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${icons[type]} toast-icon"></i>
        <div class="toast-content">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

// ==================== SEARCH ====================
document.getElementById('student-search')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const list = document.getElementById('student-list');
    if (!list) return;
    
    const filtered = STUDENTS.filter(s => 
        !releasedStudentsToday.has(s.name) &&
        (s.name.toLowerCase().includes(term) || s.class.toLowerCase().includes(term))
    );
    
    if (filtered.length === 0) {
        list.innerHTML = '<li class="empty-state"><i class="fas fa-users"></i><h3>No students found</h3></li>';
        return;
    }
    
    let html = '';
    filtered.forEach(s => {
        const isPending = allPendingPickups.some(([_, p]) => p.name === s.name);
        html += `
            <li class="list-item">
                <div class="student-info">
                    <div class="student-name">${s.name}</div>
                    <span class="student-class">${s.class}</span>
                </div>
                <div style="display:flex;gap:8px">
                    ${isPending ? `
                        <button class="btn" style="background:#ef4444;color:white" onclick="undoMarkParent('${s.name}')">
                            UNDO
                        </button>
                    ` : ''}
                    <button class="btn ${isPending ? 'btn-secondary' : 'btn-primary'}" 
                        ${isPending ? 'disabled' : ''}
                        onclick="markParentArrived('${s.name}', '${s.class}', '${s.year}')">
                        ${isPending ? 'Waiting' : 'Parent Here'}
                    </button>
                </div>
            </li>
        `;
    });
    
    list.innerHTML = html;
});

// ==================== SECTION SWITCHING ====================
window.showSection = function(section) {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.role-btn.${section}`).classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`${section}-section`).classList.add('active');
};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('App starting...');
    document.getElementById('total-students').textContent = STUDENTS.length;
    renderStudentList();
    updateYearFilterButtons();
    setupConfirmationDialog();
});

console.log('App ready!');