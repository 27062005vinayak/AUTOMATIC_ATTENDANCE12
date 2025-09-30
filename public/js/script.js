// =================================================================
// FIREBASE AUTHENTICATION SETUP
// =================================================================

// IMPORTANT: PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE
const firebaseConfig = {
  apiKey: "AIzaSyD4A4m6z8kUX3ySgJg_14yjGz2HvOMVeGg",
  authDomain: "automatic-attendance-6750c.firebaseapp.com",
  projectId: "automatic-attendance-6750c",
  storageBucket: "automatic-attendance-6750c.firebasestorage.app",
  messagingSenderId: "494790278503",
  appId: "1:494790278503:web:0063ddaa2c2f765a86c3c2",
  measurementId: "G-PL0J3QHDF6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// =================================================================
// SCALABLE APP CODE ( Firestore Subcollections )
// =================================================================

/* ---------- Globals & Utilities ---------- */
const MODELS_URL = "https://justadudewhohacks.github.io/face-api.js/models";

const loginPage = document.getElementById('login-page');
const mainApp = document.getElementById('main-app');

// This 'db' object now acts as a local cache, populated from Firestore on login.
let db = { students: [], attendance: [] };
const video = document.getElementById("video");
const photoCanvas = document.getElementById("photo-canvas");
const photoCtx = photoCanvas.getContext("2d");

/* Nice toast-ish log */
function log(msg){ const logEl = document.getElementById("recog-log"); const p = document.createElement("p"); p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`; logEl.prepend(p); }

/* Create unique ID */
function uid(prefix="id"){ return prefix + "_" + Math.random().toString(36).slice(2,9); }


/* ---------- UI navigation ---------- */
document.querySelectorAll(".sidebar li").forEach(li=>{
  li.addEventListener("click", ()=> {
    document.querySelectorAll(".sidebar li").forEach(x=>x.classList.remove("active"));
    li.classList.add("active");
    const page = li.dataset.page;
    document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
    document.getElementById("page-"+page).classList.add("active");
  });
});


/* ---------- FIREBASE GOOGLE AUTHENTICATION LOGIC ---------- */
const googleProvider = new firebase.auth.GoogleAuthProvider();

const signInWithGoogle = () => {
  auth.signInWithPopup(googleProvider)
    .then((result) => {
      console.log("Google Sign-in successful", result.user);
    }).catch((error) => {
      console.error("Google Sign-in error", error);
      alert("There was an error signing in. Please check the console.");
    });
};

document.getElementById("btn-google-login").addEventListener("click", signInWithGoogle);
document.getElementById("btn-logout").addEventListener("click", () => auth.signOut());

// Listen for auth state changes to control the UI and load all data from subcollections
auth.onAuthStateChanged(async (user) => {
  if (user) {
    if (user.email !== 'vinayak@gmail.com') {
      alert('Access Denied. This application is restricted to the administrator.');
      auth.signOut();y
      return;
    }

    try {
        const studentsSnapshot = await db_firestore.collection('users').doc(user.uid).collection('students').get();
        db.students = studentsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));

        const attendanceSnapshot = await db_firestore.collection('users').doc(user.uid).collection('attendance').get();
        db.attendance = attendanceSnapshot.docs.map(doc => doc.data());

        console.log(`Loaded ${db.students.length} students and ${db.attendance.length} attendance records.`);
        updateUIFromDB();
    } catch (error) {
        console.error("Error loading data from Firestore: ", error);
        alert("Could not load data. Check console for errors.");
    }

    // Show the main app.
    loginPage.style.display = 'none';
    mainApp.style.display = 'flex';

    // Update header UI
    document.getElementById("btn-logout").style.display = 'inline-block';
    document.getElementById("user-display").textContent = `Welcome, ${user.displayName}`;
    document.getElementById("user-display").style.display = 'inline-block';
    
  } else {
    // User is signed out.
    loginPage.style.display = 'flex';
    mainApp.style.display = 'none';
    db = { students: [], attendance: [] }; // Clear local cache on logout
    updateUIFromDB();
  }
});


/* ---------- Camera & Capture ---------- */
async function startCamera(){
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } , audio: false });
    video.srcObject = stream;
  }catch(e){
    alert("Enable Camera Permission");
    console.error(e);
  }
}
document.getElementById("btn-capture").addEventListener("click", ()=>{
  photoCtx.drawImage(video, 0, 0, photoCanvas.width, photoCanvas.height);
});
document.getElementById("btn-clear-photo").addEventListener("click", ()=> {
  photoCtx.clearRect(0,0,photoCanvas.width,photoCanvas.height);
});


/* ---------- face-api model loading ---------- */
async function loadModels(){
  log("Loading face models...");
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
  await faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL).catch(()=>{});
  log("Models loaded.");
}
loadModels().then(()=>startCamera());


/* ---------- Add Student (capture + embeddings) ---------- */
document.getElementById("btn-add-student").addEventListener("click", async (e)=>{
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to add a student.");
    return;
  }
  
  const name = document.getElementById("stu-name").value.trim();
  const sid = document.getElementById("stu-id").value.trim();
  if(!name || !sid){ alert("Name and ID required"); return; }
  const imgData = photoCanvas.toDataURL("image/png");
  if(imgData === "data:,"){ alert("Please capture a photo first"); return; }

  const img = new Image();
  img.src = imgData;
  await img.decode();
  const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
  if(!detection){ alert("No clear face detected. Try recapture with good lighting."); return; }
  const descriptor = Array.from(detection.descriptor);

  const studentData = { id: sid, name, photo: imgData, descriptor, createdAt: new Date().toISOString() , uid: uid("stu") };
  
  try {
    const docRef = await db_firestore.collection('users').doc(user.uid).collection('students').add(studentData);
    
    db.students.push({ docId: docRef.id, ...studentData });
    updateUIFromDB();
    
    document.getElementById("stu-name").value=""; document.getElementById("stu-id").value="";
    photoCtx.clearRect(0,0,photoCanvas.width,photoCanvas.height);
    alert("Student saved successfully.");
  } catch (error) {
    console.error("Error saving student to Firestore: ", error);
    alert("Could not save the data to the cloud. Check console for errors.");
  }
});


/* ---------- Update UI from DB ---------- */
function updateUIFromDB(){
  // Sort the student list by ID for consistent display order
  db.students.sort((a, b) => Number(a.id) - Number(b.id));

  const currentStudentIds = new Set(db.students.map(s => s.id));
  const today = new Date().toISOString().slice(0, 10);

  const presentRecordsToday = db.attendance.filter(a =>
      a.date === today &&
      a.status === "present" &&
      currentStudentIds.has(a.studentId)
  );

  const uniquePresentStudentIds = new Set(presentRecordsToday.map(a => a.studentId));
  const presentToday = uniquePresentStudentIds.size;

  // Update dashboard stats
  document.getElementById("stat-total").textContent = db.students.length;
  document.getElementById("stat-today").textContent = presentToday;
  
  // Update students grid
  const grid = document.getElementById("students-grid");
  grid.innerHTML = "";
  db.students.forEach(s => {
    const tile = document.createElement("div"); 
    tile.className="student-tile card";
    tile.innerHTML = `
      <img src="${s.photo}" alt="photo">
      <div style="font-weight:700">${s.name}</div>
      <div style="font-size:12px;color:var(--muted)">${s.id}</div>
      <button class="delete-btn" data-doc-id="${s.docId}">Delete</button>
    `;
    grid.appendChild(tile);
  });

  // Re-attach delete handlers
  grid.querySelectorAll(".delete-btn").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const user = auth.currentUser;
      const docId = btn.dataset.docId;
      if (!user || !docId) return;

      if(confirm("Are you sure you want to delete this student?")){
        try {
          await db_firestore.collection('users').doc(user.uid).collection('students').doc(docId).delete();
          
          db.students = db.students.filter(s => s.docId !== docId);
          updateUIFromDB();
          alert("Student deleted.");
        } catch (error) {
          console.error("Error deleting student: ", error);
          alert("Could not delete student. Check console for errors.");
        }
      }
    });
  });
  
  // Update dropdowns
  const cs = document.getElementById("class-select");
  const ms = document.getElementById("manual-stu");
  cs.innerHTML = ""; ms.innerHTML = "";
  const defOpt = document.createElement("option"); defOpt.textContent="Default Class"; cs.appendChild(defOpt);
  db.students.forEach(s=>{
    const opt = document.createElement("option"); opt.value=s.uid; opt.textContent = `${s.name} (${s.id})`; cs.appendChild(opt);
    const opt2 = opt.cloneNode(true); ms.appendChild(opt2);
  });
  
  // Update report date
  document.getElementById("report-date").value = today;
}


/* ---------- Face recognition marking ---------- */
let recogInterval = null;
let recogStream = null;
let labeledDescriptors = null;

async function prepareLabeledDescriptors(){
  labeledDescriptors = db.students.map(s=>{
    return new faceapi.LabeledFaceDescriptors(s.uid, [ new Float32Array(s.descriptor) ]);
  });
  log("Prepared labeled descriptors: "+ labeledDescriptors.length);
}

document.getElementById("start-recog").addEventListener("click", async ()=>{
  if(db.students.length === 0){ alert("No students saved. Add students first."); return; }
  await prepareLabeledDescriptors();
  const videoEl = document.getElementById("recog-video");
  try{
    recogStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    videoEl.srcObject = recogStream;
    document.getElementById("start-recog").disabled = true;
    document.getElementById("stop-recog").disabled = false;
    startRecognitionLoop();
  }catch(e){ alert("Camera permission for recognition required."); console.error(e); }
});

document.getElementById("stop-recog").addEventListener("click", ()=>{
  stopRecognitionLoop();
  document.getElementById("start-recog").disabled = false;
  document.getElementById("stop-recog").disabled = true;
  if(recogStream){ recogStream.getTracks().forEach(t=>t.stop()); recogStream=null; }
});

function stopRecognitionLoop(){
  if(recogInterval) { clearInterval(recogInterval); recogInterval=null; }
}

async function startRecognitionLoop(){
  const videoEl = document.getElementById("recog-video");
  const overlay = document.getElementById("overlay");
  
  overlay.width = videoEl.clientWidth;
  overlay.height = videoEl.clientHeight;
  
  overlay.style.position = 'relative';
  overlay.style.top = `-${overlay.height}px`;
  overlay.style.marginBottom = `-${overlay.height}px`;

  const displaySize = { width: overlay.width, height: overlay.height };
  faceapi.matchDimensions(overlay, displaySize);

  const threshold = parseFloat(document.getElementById("threshold").value) || 0.55;
  const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, threshold);

  recogInterval = setInterval(async ()=>{
    if(videoEl.readyState < 2) return;
    const detections = await faceapi.detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
    const resized = faceapi.resizeResults(detections, displaySize);
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0,0,overlay.width,overlay.height);
    resized.forEach(det=>{
      const best = faceMatcher.findBestMatch(det.descriptor);
      const box = det.detection.box;
      ctx.strokeStyle = "#ffd88a"; ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.font = "14px Inter";
      ctx.fillStyle = "#ffd88a";
      ctx.fillText(best.toString(), box.x, box.y - 6);

      if(best.label !== "unknown"){
        const stud = db.students.find(s=>s.uid === best.label);
        if(stud){
          markAttendance(stud.id, stud.name, "present");
          log(`Recognized ${stud.name} (${stud.id})`);
        }
      }
    });
  }, 900);
}


/* ---------- Attendance storage ---------- */
async function markAttendance(sid, sname, status="present", date=null){
  const user = auth.currentUser;
  if (!user) return;
  date = date || new Date().toISOString().slice(0,10);
  
  const existing = db.attendance.find(a=>a.studentId===sid && a.date===date);
  if (existing) return;
  
  const attendanceRecord = { studentId: sid, studentName: sname, date, status, id: uid("att"), createdAt: new Date().toISOString() };
  
  db.attendance.push(attendanceRecord);
  updateUIFromDB();
  
  try {
    await db_firestore.collection('users').doc(user.uid).collection('attendance').add(attendanceRecord);
  } catch (error) {
    console.error("Error saving attendance:", error);
  }
}

/* Manual mark button */
document.getElementById("btn-manual-save").addEventListener("click", ()=>{
  const sid = document.getElementById("manual-stu").value;
  const stu = db.students.find(s=>s.uid===sid);
  const date = document.getElementById("manual-date").value || new Date().toISOString().slice(0,10);
  const status = document.getElementById("manual-status").value;
  if(!stu){ alert("Select student"); return; }
  markAttendance(stu.id, stu.name, status, date);
  alert("Manual attendance saved");
});

/* Quick manual mark from controls */
document.getElementById("manual-mark").addEventListener("click", ()=>{
  document.querySelector(".sidebar li[data-page='backup']").click();
});


/* ---------- Reports ---------- */
document.getElementById("report-date").addEventListener("change", ()=>{
  const d = document.getElementById("report-date").value;
  showDailyReport(d);
});
function showDailyReport(date){
  const out = document.getElementById("report-output");
  out.innerHTML = "";
  const students = [...db.students];

  students.sort((a, b) => Number(a.id) - Number(b.id));

  const rows = students.map(s=>{
    const a = db.attendance.find(x=>x.studentId===s.id && x.date===date);
    const timeStr = a ? new Date(a.createdAt).toLocaleTimeString() : "-";
    return `<tr>
      <td>${s.id}</td>
      <td>${s.name}</td>
      <td>${a ? a.status : 'absent'}</td>
      <td>${timeStr}</td>
    </tr>`;
  }).join("");
  out.innerHTML = `
    <h2>Daily Report for ${date}</h2>
    <table style="width:100%;border-collapse:collapse">
      <thead>
         <tr>
          <td><h1>ID</h1></td>
          <td><h1>Name</h1></td>
          <td><h1>Status</h1></td>
          <td><h1>Time</h1></td>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}


/* ---------- NEW STUDENT HISTORY PDF EXPORT ---------- */
function exportStudentHistoryAsPDF() {
    const studentId = document.getElementById("history-stu-id").value.trim();
    const endDateStr = document.getElementById("report-date").value;

    if (!studentId || !endDateStr) {
        alert("Please enter a Student ID and select an end date.");
        return;
    }

    const student = db.students.find(s => s.id === studentId);
    if (!student) {
        alert("Student with that ID not found.");
        return;
    }

    const endDate = new Date(endDateStr);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);
    const startDateStr = startDate.toISOString().slice(0, 10);

    // 1. Filter records for the student within the date range
    const historyRecords = db.attendance
        .filter(a => a.studentId === studentId && a.date >= startDateStr && a.date <= endDateStr);

    // 2. De-duplicate: Keep only the first record for each day
    const uniqueDailyRecords = [];
    const seenDates = new Set();
    for (const record of historyRecords) {
        if (!seenDates.has(record.date)) {
            uniqueDailyRecords.push(record);
            seenDates.add(record.date);
        }
    }
    
    // 3. Sort the clean list by date
    uniqueDailyRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 4. Generate PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const headers = [['Date', 'Status', 'Time']];

    const body = uniqueDailyRecords.map(a => {
        const timeStr = new Date(a.createdAt).toLocaleTimeString();
        return [a.date, a.status, timeStr];
    });

    doc.text(`Attendance History for ${student.name} (ID: ${student.id})`, 14, 15);
    doc.text(`Report Period: ${startDateStr} to ${endDateStr}`, 14, 22);
    doc.autoTable({ head: headers, body: body, startY: 30 });

    doc.save(`history_report_${student.name.replace(/ /g, '_')}_${endDateStr}.pdf`);
}
document.getElementById("btn-get-history-pdf").addEventListener("click", exportStudentHistoryAsPDF);


/* ---------- EXPORT / IMPORT FUNCTIONALITY ---------- */
document.getElementById("btn-export").addEventListener("click", ()=>{
  const dataToExport = {
      students: db.students.map(({ docId, ...student }) => student),
      attendance: db.attendance
  };
  const data = JSON.stringify(dataToExport, null, 2);
  const blob = new Blob([data], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "presentify_backup.json"; a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("btn-import").addEventListener("click", () => {
    document.getElementById("import-file").click();
});

document.getElementById("import-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) {
        alert("You must be logged in to import data.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!importedData.students || !importedData.attendance) {
                throw new Error("Invalid backup file format.");
            }

            if (!confirm("This will DELETE all current data and replace it with the backup. This cannot be undone. Continue?")) {
                event.target.value = null;
                return;
            }

            const batch = db_firestore.batch();

            const studentsQuery = await db_firestore.collection('users').doc(user.uid).collection('students').get();
            studentsQuery.forEach(doc => batch.delete(doc.ref));

            const attendanceQuery = await db_firestore.collection('users').doc(user.uid).collection('attendance').get();
            attendanceQuery.forEach(doc => batch.delete(doc.ref));

            importedData.students.forEach(student => {
                const newStudentRef = db_firestore.collection('users').doc(user.uid).collection('students').doc();
                batch.set(newStudentRef, student);
            });

            importedData.attendance.forEach(att => {
                const newAttRef = db_firestore.collection('users').doc(user.uid).collection('attendance').doc();
                batch.set(newAttRef, att);
            });

            await batch.commit();

            const studentsSnapshot = await db_firestore.collection('users').doc(user.uid).collection('students').get();
            db.students = studentsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));

            const attendanceSnapshot = await db_firestore.collection('users').doc(user.uid).collection('attendance').get();
            db.attendance = attendanceSnapshot.docs.map(doc => doc.data());

            updateUIFromDB();
            alert("Import successful! Data has been restored.");

        } catch (error) {
            console.error("Import failed:", error);
            alert("Import failed. Make sure you are using a valid backup file. Check console for details.");
        } finally {
            event.target.value = null;
        }
    };
    reader.readAsText(file);
});


/* Sync Button */
document.getElementById("btn-sync").addEventListener("click", ()=>{
  alert("Data is now synced automatically with the cloud.");
});


/* Threshold slider */
const th = document.getElementById("threshold");
th.addEventListener("input", ()=> document.getElementById("threshold-val").textContent = th.value );


/* ---------- PDF EXPORT FUNCTIONALITY ---------- */
function exportDailyReportAsPDF() {
    const date = document.getElementById("report-date").value;
    if (!date) {
        alert("Please select a date for the daily report.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const headers = [['Name', 'Student ID', 'Status']];
    
    const body = db.students.map(student => {
        const record = db.attendance.find(a => a.studentId === student.id && a.date === date);
        const status = record ? record.status : 'absent';
        return [student.name, student.id, status];
    });

    doc.text(`Daily Attendance Report for ${date}`, 14, 15);
    doc.autoTable({ head: headers, body: body, startY: 20 });

    doc.save(`daily_attendance_report_${date}.pdf`);
}

document.getElementById("btn-export-pdf").addEventListener("click", exportDailyReportAsPDF);


/* ---------- Initialize ---------- */
startCamera();