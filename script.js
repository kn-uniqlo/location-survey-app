import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://xgcwpzzjuuqcvrbjgbrt.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnY3dwenpqdXVxY3ZyYmpnYnJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4Mzc5ODAsImV4cCI6MjA2MTQxMzk4MH0.9khXG6_OzhncnqCvS_olXybbDIm6vQFRf_O7YpqEE5A'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

window.supabase = supabase;

// If absolute URL from the remote server is provided, configure the CORS
// header on that server.
let url = '';
let currentPDFId = null;

// Loaded via <script> tag, create shortcut to access PDF.js exports.
var { pdfjsLib } = globalThis;

// The workerSrc property shall be specified.
pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.mjs';

var pdfDoc = null,
    pageNum = 1,
    pageRendering = false,
    pageNumPending = null,
    scale = 2.0,
    canvas = document.getElementById('the-canvas'),
    ctx = canvas.getContext('2d');
var pagesRead = new Set();
var readAllPages = false;
var pageStartTime = Date.now();
var minPageTime = 5000; // 5 seconds in milliseconds
var canChangePage = true;
var startTime = Date.now();

let branchesData = null;

// Function to load branches data
async function loadBranches() {
    const response = await fetch('branches.json');
    branchesData = await response.json();
    populateSearch();
}

// Function to populate search suggestions
function populateSearch() {
    const searchInput = document.getElementById('branchSearch');
    const datalist = document.getElementById('branchList');

    datalist.innerHTML = ''
    // Create an object to store branch info
    const branchInfo = {};

    branchesData.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch.name;
        option.setAttribute('data-id', branch.id);
        datalist.appendChild(option);
        
        // Store branch info
        branchInfo[branch.id] = {
            name: branch.name,
            address: branch.address,
            dolly: branch.dolly || '19:00 - 20:00 น.',
            hours: branch.hours || '15:00 - 18:00 น.',
            phone: branch.phone || '02-XXX-XXXX',
            transport: branch.transport || 'VIEW MAP',
            mapLink: branch.mapLink
        };
    });

    searchInput.addEventListener('input', function() {
        const selectedOption = datalist.querySelector(`option[value="${this.value}"]`);
        if (selectedOption) {
            const branchId = selectedOption.dataset.id;
            const selectedBranch = branchInfo[branchId];
            
            // Update branch info display
            document.getElementById('branchName').textContent = selectedBranch.name;
            document.getElementById('branchAddress').textContent = selectedBranch.address;
            document.getElementById('branchDolly').textContent = selectedBranch.dolly;
            document.getElementById('branchHours').textContent = selectedBranch.hours;
            document.getElementById('branchPhone').textContent = selectedBranch.phone;
            document.getElementById('branchTransport').textContent = selectedBranch.transport;
            document.getElementById('mapLink').href = selectedBranch.mapLink;
            
            // Show the branch info section
            document.getElementById('branchInfo').classList.add('show');
            
            // Load the PDF
            loadNewPdf(branchId);
        }
    });
}

// Function to load new PDF
function loadNewPdf(id) {
    currentPDFId = id;
    isReadConfirmed = false; // รีเซ็ตสถานะเมื่อโหลด PDF ใหม่
    url = `https://kn-uniqlo.github.io/location-survey-app/pdfs/${id}.pdf`;
    pdfjsLib.getDocument(url).promise.then(function(pdfDoc_) {
        pdfDoc = pdfDoc_;
        document.getElementById('page_count').textContent = pdfDoc.numPages;
        pageNum = 1;
        pagesRead.clear();
        readAllPages = false;
        document.getElementById('read-btn').disabled = true;
        document.getElementById('canvasPlaceholder').style.display = 'none';
        document.getElementById('the-canvas').style.display = 'block';
        
        // Reset read button
        const readBtn = document.getElementById('read-btn');
        readBtn.disabled = true;
        readBtn.classList.remove('confirmed');
        readBtn.classList.remove('active');
        readBtn.innerHTML = '<i class="fas fa-check-circle"></i> อ่านแล้ว';
        renderPage(pageNum);
        enablePDFButtons();
    });
}

// Load branches data when the page loads
loadBranches();

// Download PDF function
function downloadPDF() {
    if (currentPDFId) { 
    const pdfUrl = `https://raw.githubusercontent.com/kn-uniqlo/location-survey-app/main/pdfs/${currentPDFId}.pdf`;
    
    // สร้างลิงก์ดาวน์โหลด
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `${currentPDFId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    } else {
    alert('กรุณาเลือกสาขาก่อน');
    }
}

// View in new tab function
function viewInNewTab() {
    if (currentPDFId) {
    const pdfUrl = `https://kn-uniqlo.github.io/location-survey-app/pdfs/${currentPDFId}.pdf`;  
    window.open(pdfUrl, '_blank');
    } else {
    alert('กรุณาเลือกสาขาก่อน');
    }
}

// Ensure buttons are enabled when PDF is loaded
function enablePDFButtons() {
    document.getElementById('downloadBtn').disabled = false;
    document.getElementById('viewBtn').disabled = false;
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('downloadBtn').addEventListener('click', downloadPDF);
    document.getElementById('viewBtn').addEventListener('click', viewInNewTab);
});

/**
    * Get page info from document, resize canvas accordingly, and render page.
    * @param num Page number.
    */
function renderPage(num) {
    pageRendering = true;
    // Reset page timer and lock navigation
    pageStartTime = Date.now();
    canChangePage = false;
    setTimeout(() => {
    canChangePage = true;
    }, minPageTime);

    // Using promise to fetch the page
    pdfDoc.getPage(num).then(function(page) {
    var viewport = page.getViewport({scale: scale});
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Render PDF page into canvas context
    var renderContext = {
        canvasContext: ctx,
        viewport: viewport
    };
    var renderTask = page.render(renderContext);

    // Wait for rendering to finish
    renderTask.promise.then(function() {
        pageRendering = false;
        if (pageNumPending !== null) {
        // New page rendering is pending
        renderPage(pageNumPending);
        pageNumPending = null;
        }
    });

    // Track read pages
    pagesRead.add(num);
    updateReadStatus();
    });

    // Update page counters
    document.getElementById('page_num').textContent = num;
}

/**
    * If another page rendering in progress, waits until the rendering is
    * finised. Otherwise, executes rendering immediately.
    */
function queueRenderPage(num) {
    if (pageRendering) {
    pageNumPending = num;
    } else {
    renderPage(num);
    }
}

/**
    * Displays previous page.
    */
function onPrevPage() {
    if (pageNum <= 1) {
    return;
    }
    pageNum--;
    queueRenderPage(pageNum);
}
document.getElementById('prev').addEventListener('click', onPrevPage);

/**
    * Displays next page.
    */
function onNextPage() {
    if (!canChangePage) {
    alert('เพื่อความเข้าใจข้อมูลอย่างครบถ้วน โปรดอ่านเอกสารข้อควรระวังก่อนหน้าถัดไป');
    return;
    }
    if (pageNum >= pdfDoc.numPages) {
    return;
    }
    pageNum++;
    queueRenderPage(pageNum);
}
document.getElementById('next').addEventListener('click', onNextPage);

/**
    * Asynchronously downloads PDF.
    */
pdfjsLib.getDocument(url).promise.then(function(pdfDoc_) {
    pdfDoc = pdfDoc_;
    document.getElementById('page_count').textContent = pdfDoc.numPages;

    // Initial/first page rendering
    renderPage(pageNum);
});

function updateReadStatus() {
    if (pagesRead.size === pdfDoc.numPages && !readAllPages) {
    readAllPages = true;
    document.getElementById('read-btn').disabled = false;
    document.getElementById('read-btn').classList.remove('disabled');
    document.getElementById('read-btn').classList.add('active');
    }
    document.getElementById('').innerHTML = 
    `${pageNum} <span class="read-status">${pagesRead.has(pageNum) ? '✓' : ''}</span>`;
}

function saveReadingStats() {
    const readingData = {
    totalPages: pdfDoc.numPages,
    readPages: pagesRead.size,
    completionTime: Date.now() - startTime,
    completedAt: new Date().toISOString()
    };
    // Here you can send the data to your server
    console.log('Reading stats:', readingData);
}


// Function to record view statistics
async function recordView(branchId, branchName) {
    const today = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toISOString();

    // บันทึกข้อมูลรายละเอียดการเข้าชม
    const { error: insertLogError } = await supabase
    .from('view_logs') // เปลี่ยนเป็นชื่อตารางสำหรับ logs
    .insert([
        {
        branch_id: branchId,
        timestamp: timestamp,
        user_agent: navigator.userAgent,
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language
        }
    ]);

    if (insertLogError) {
    console.error('Error recording view log:', insertLogError);
    }

    // อัปเดตจำนวนการเข้าชมทั้งหมด
    const { data: dailyData, error: dailyError } = await supabase
    .from('branch_stats') // เปลี่ยนเป็นชื่อตารางสำหรับสถิติ
    .select('view_count')
    .eq('branch_id', branchId)
    .eq('date', today)
    .single();

    let newDailyCount = 1;
    if (!dailyError && dailyData) {
    newDailyCount = dailyData.view_count + 1;
    }

    const { error: updateDailyError } = await supabase
    .from('branch_stats')
    .upsert([
        { 
        branch_id: branchId, 
        view_count: newDailyCount, 
        date: today 
        }
    ], { onConflict: ['branch_id', 'date'] });

    if (updateDailyError) {
    console.error('Error updating daily view count:', updateDailyError);
    }

    // อัปเดตชื่อสาขา (ถ้ายังไม่มี)
    const { error: upsertNameError } = await supabase
    .from('branch_names') // เปลี่ยนเป็นชื่อตารางสำหรับชื่อสาขา
    .upsert([
        { id: branchId, name: branchName }
    ], { onConflict: ['id'] });

    if (upsertNameError) {
    console.error('Error updating branch name:', upsertNameError);
    }
}

// Add event listener for read button
document.getElementById('read-btn').addEventListener('click', async function() {
    if (readAllPages && !isReadConfirmed) {
    const branchId = currentPDFId; // Assuming currentPDFId holds the current branch ID
    const branchName = document.getElementById('branchName').textContent;

    // Record the view
    await recordView(branchId, branchName);

    // อัปเดต UI
    this.disabled = true;
    this.classList.remove('active');
    this.classList.add('confirmed');
    this.innerHTML = '<i class="fas fa-check-circle"></i> ยืนยันการอ่านแล้ว';
    isReadConfirmed = true;

    alert('ขอบคุณที่อ่านเอกสารจนจบ!');
    }
});

// Toggle admin panel
function toggleAdminPanel() {
    const panel = document.getElementById('adminPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';

    if (panel.style.display === 'block') {
    loadStats();
    }
}

// Load statistics from Firebase
// ปรับเปลี่ยนฟังก์ชัน loadStats สำหรับ Supabase
async function loadStats() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    try {
    const today = new Date().toISOString().split('T')[0];
    const queryStartDate = startDate || today;
    const queryEndDate = endDate || today;

    // Get daily stats
    const { data: dailyStats, error: dailyError } = await supabase
        .from('branch_stats') // เปลี่ยนเป็นชื่อตารางสำหรับสถิติ
        .select('date, branch_id, view_count')
        .gte('date', queryStartDate)
        .lte('date', queryEndDate);

    if (dailyError) {
        console.error('Error loading daily stats:', dailyError);
        alert('เกิดข้อผิดพลาดในการโหลดสถิติ');
        return;
    }

    // ดึงชื่อสาขาจากตาราง branch_names
    const { data: namesData, error: namesError } = await supabase
        .from('branch_names')
        .select('id, name');

    if (namesError) {
        console.error('Error loading branch names:', namesError);
        // อาจจะยังแสดงผลโดยใช้ branch_id แทน
    }

    const branchNames = namesData?.reduce((acc, curr) => {
        acc[curr.id] = curr.name;
        return acc;
    }, {});

    displayStats(dailyStats, branchNames);

    } catch (error) {
    console.error('Error loading stats:', error);
    alert('เกิดข้อผิดพลาดในการโหลดสถิติ');
    }
}

// ปรับเปลี่ยนฟังก์ชัน displayStats สำหรับ Supabase
function displayStats(statsData, branchNames = {}) {
    const statsBody = document.getElementById('statsBody');
    statsBody.innerHTML = '';

    let totalViews = 0;
    const branchSet = new Set();
    const dailyStats = {};

    statsData.forEach(item => {
    const { date, branch_id, view_count } = item;
    totalViews += view_count;
    branchSet.add(branch_id);

    if (!dailyStats[date]) {
        dailyStats[date] = {};
    }
    dailyStats[date][branch_id] = (dailyStats[date][branch_id] || 0) + view_count;
    });

    // เรียงลำดับวันที่จากใหม่ไปเก่า
    const sortedDates = Object.keys(dailyStats).sort().reverse();

    sortedDates.forEach(date => {
    const branches = dailyStats[date];
    for (const branchId in branches) {
        const viewCount = branches[branchId];

        const row = document.createElement('tr');

        const dateCell = document.createElement('td');
        dateCell.textContent = formatDate(date);

        const branchCell = document.createElement('td');
        branchCell.textContent = branchNames[branchId] || branchId;

        const countCell = document.createElement('td');
        countCell.textContent = viewCount;

        row.appendChild(dateCell);
        row.appendChild(branchCell);
        row.appendChild(countCell);
        statsBody.appendChild(row);
    }
    });

    document.getElementById('totalViews').textContent = totalViews;
    document.getElementById('totalBranches').textContent = branchSet.size;
}

// จัดรูปแบบวันที่
function formatDate(dateString) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
    // ตั้งค่าวันที่เริ่มต้นและสิ้นสุดในฟิลเตอร์
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('startDate').value = today;
    document.getElementById('endDate').value = today;

    // Load branches data
    await loadBranches();

    // เพิ่ม event listener สำหรับปุ่ม adminBtn ตรงนี้เพียงครั้งเดียว
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
    adminBtn.addEventListener('click', toggleAdminPanel);
    }

    // เพิ่ม event listener สำหรับปุ่ม filterStatsBtn
    const filterStatsBtn = document.getElementById('filterStatsBtn');
    if (filterStatsBtn) {
    filterStatsBtn.addEventListener('click', loadStats);
    }

    // Show scroll to top button when scrolling down
    window.addEventListener('scroll', function() {
    const floatingBtn = document.querySelector('.floating-btn');
    if (window.pageYOffset > 300) {
        floatingBtn.style.display = 'flex';
    } else {
        floatingBtn.style.display = 'none';
    }
    });
});
// เพิ่มตัวแปร global เพื่อเก็บสถานะ
let isReadConfirmed = false;