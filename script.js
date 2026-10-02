// ===================================================
// CONFIGURATION & GLOBAL VARIABLES
// ===================================================

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzYWk95KvnThJZJfkLCYGXCNJr1u--UMgZB7Hh5UZR4R91Vnv7LoAGC2Plve2HQTaF2lQ/exec";

// Daftar Kelas Sesuai Revisi
const DEFAULT_KELAS_LIST = [
    "1 A", "1 B", "1 C", "1 D",
    "2 A", "2 B", "2 C",
    "3 Putra", "3 Putri",
    "4 Putra", "4 Putri",
    "5 Putra", "5 Putri",
    "6 Putra", "6 Putri"
];

let MAPEL_PER_KELAS = JSON.parse(localStorage.getItem('MAPEL_PER_KELAS')) || {
    "1 A": [{ nama: "القرآن الكريم", kkm: 70 }, { nama: "المبادئ الفقهية", kkm: 70 }],
    "1 B": [{ nama: "القرآن الكريم", kkm: 70 }, { nama: "المبادئ الفقهية", kkm: 70 }],
    "2 A": [{ nama: "القرآن الكريم", kkm: 70 }, { nama: "المبادئ الفقهية", kkm: 70 }],
    "3 Putra": [{ nama: "القرآن الكريم", kkm: 70 }, { nama: "المبادئ الفقهية", kkm: 70 }]
};

let DATA_SANTRI = [];

// ===================================================
// INITIALIZATION
// ===================================================
document.addEventListener("DOMContentLoaded", () => {
    initTabNavigation();
    populateKelasDropdowns();
    loadDataFromCloud();
});

// Navigasi Tab Utama (Menu Sidebar)
function initTabNavigation() {
    const navItems = document.querySelectorAll('.sidebar li');
    const tabContents = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = item.getAttribute('data-tab');
            if (!targetTab) return;

            navItems.forEach(nav => nav.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.remove('active'));

            item.classList.add('active');
            const targetEl = document.getElementById(targetTab);
            if (targetEl) targetEl.classList.add('active');

            if (targetTab === 'kelola-mapel') renderMapelTable();
            if (targetTab === 'input-nilai') renderSpreadsheetNilai();
            if (targetTab === 'cetak-raport') loadSantriCetakDropdown();
            if (targetTab === 'kelola-santri') renderTabelKelolaSantri();
        });
    });
}

// Populate Dropdown Pilihan Kelas pada Seluruh Form
function populateKelasDropdowns() {
    const allKelas = Array.from(new Set([...DEFAULT_KELAS_LIST, ...Object.keys(MAPEL_PER_KELAS)]));
    const selectIds = ['select-kelas-santri', 'select-kelas-mapel', 'select-kelas-nilai', 'select-kelas-cetak'];
    
    selectIds.forEach(id => {
        const selectEl = document.getElementById(id);
        if (selectEl) {
            const curVal = selectEl.value;
            selectEl.innerHTML = '<option value="">-- Pilih Kelas --</option>';
            
            allKelas.forEach(kls => {
                const opt = document.createElement('option');
                opt.value = kls;
                opt.textContent = kls;
                selectEl.appendChild(opt);
            });
            
            if (curVal && allKelas.includes(curVal)) {
                selectEl.value = curVal;
            }
        }
    });
}

// ===================================================
// LOAD DATA FROM CLOUD (GOOGLE SHEETS)
// ===================================================
async function loadDataFromCloud() {
    const statusEl = document.getElementById('sync-status');
    if (statusEl) {
        statusEl.className = 'status-cloud';
        statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memuat data...';
    }

    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("GANTI_DENGAN_URL")) {
        if (statusEl) {
            statusEl.className = 'status-cloud-error';
            statusEl.innerHTML = '⚠️ Atur GOOGLE_SCRIPT_URL di script.js dulu';
        }
        return;
    }

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const resData = await response.json();

        let listSantri = Array.isArray(resData) ? resData : (resData.santri || []);
        let listMapelData = resData.mapel || [];

        DATA_SANTRI = listSantri.map(item => ({
            nis: String(item.nis || ''),
            nama: item.nama || item['nama santri'] || '',
            wali: item.wali || item['nama wali'] || '',
            kelas: item.kelas || item['kelas & ruang'] || '',
            kehadiran: {
                S: parseInt(item.sakit || item.s || 0),
                I: parseInt(item.izin || item.i || 0),
                A: parseInt(item.alpha || item.alfa || item.a || 0)
            },
            nilai: typeof item.nilai === 'string' ? parseJsonSafe(item.nilai) : (item.nilai || {})
        }));

        if (listMapelData.length > 0) {
            let tempMapel = {};
            listMapelData.forEach(m => {
                const kls = m.kelas;
                if (!kls) return;
                if (!tempMapel[kls]) tempMapel[kls] = [];
                tempMapel[kls].push({
                    nama: m.nama || m['nama mapel'] || '',
                    kkm: parseInt(m.kkm) || 70
                });
            });
            if (Object.keys(tempMapel).length > 0) {
                MAPEL_PER_KELAS = tempMapel;
                localStorage.setItem('MAPEL_PER_KELAS', JSON.stringify(MAPEL_PER_KELAS));
            }
        }

        populateKelasDropdowns();

        if (statusEl) {
            statusEl.className = 'status-cloud-success';
            statusEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Terhubung ke Google Sheets';
        }

        renderTabelKelolaSantri();

    } catch (err) {
        console.error(err);
        if (statusEl) {
            statusEl.className = 'status-cloud-error';
            statusEl.innerHTML = '⚠️ Mode Lokal (Koneksi Cloud Gagal)';
        }
    }
}

function parseJsonSafe(str) {
    try { return JSON.parse(str); } catch (e) { return {}; }
}

// ===================================================
// KELOLA DATA SANTRI
// ===================================================
async function simpanSantriBaru(event) {
    if (event) event.preventDefault();

    const nis = document.getElementById('input-nis')?.value.trim();
    const nama = document.getElementById('input-nama')?.value.trim();
    const wali = document.getElementById('input-wali')?.value.trim();
    const kelas = document.getElementById('select-kelas-santri')?.value;

    if (!nis || !nama || !wali || !kelas) {
        alert("Semua kolom data santri wajib diisi!");
        return;
    }

    const payload = {
        action: "saveSantri",
        nis: nis, nama: nama, wali: wali, kelas: kelas,
        sakit: 0, izin: 0, alpha: 0, nilai: {}
    };

    try {
        alert("Menyimpan Santri...");
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        alert("Santri berhasil ditambahkan!");
        document.getElementById('form-tambah-santri')?.reset();
        await loadDataFromCloud();
    } catch (err) {
        alert("Gagal menyimpan santri.");
    }
}

function renderTabelKelolaSantri() {
    const tbody = document.getElementById('tbody-kelola-santri');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (DATA_SANTRI.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Belum ada data santri</td></tr>';
        return;
    }

    DATA_SANTRI.forEach((santri, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${santri.nis}</td>
            <td>${santri.nama}</td>
            <td>${santri.wali}</td>
            <td>${santri.kelas}</td>
            <td>
                <button type="button" class="btn-danger" onclick="hapusSantri('${santri.nis}')"><i class="fa-solid fa-trash"></i> Hapus</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function hapusSantri(nis) {
    if (!confirm(`Yakin ingin menghapus santri NIS: ${nis}?`)) return;
    DATA_SANTRI = DATA_SANTRI.filter(s => s.nis !== nis);
    renderTabelKelolaSantri();
}

// ===================================================
// INPUT NILAI MODEL SPREADSHEET (GRID / TABLE MASSAL)
// ===================================================
function renderSpreadsheetNilai() {
    const kelas = document.getElementById('select-kelas-nilai')?.value;
    const thead = document.getElementById('thead-spreadsheet');
    const tbody = document.getElementById('tbody-spreadsheet');

    if (!thead || !tbody) return;

    thead.innerHTML = '';
    tbody.innerHTML = '';

    if (!kelas) {
        tbody.innerHTML = '<tr><td style="text-align:center; padding:20px;">Silakan pilih kelas terlebih dahulu.</td></tr>';
        return;
    }

    const listSantriKelas = DATA_SANTRI.filter(s => s.kelas === kelas);
    const mapelList = MAPEL_PER_KELAS[kelas] || [];

    if (listSantriKelas.length === 0) {
        tbody.innerHTML = `<tr><td style="text-align:center; padding:20px;">Belum ada santri terdaftar di ${kelas}.</td></tr>`;
        return;
    }

    // Header Tabel Spreadsheet
    let headerHTML = `
        <tr>
            <th style="width:40px;">No</th>
            <th style="width:80px;">NIS</th>
            <th style="min-width:180px;">Nama Santri</th>
    `;

    mapelList.forEach(m => {
        headerHTML += `<th style="min-width:120px; font-family:'Amiri', serif; font-size:15px;">${m.nama}<br><small style="font-family:'Poppins'; font-weight:normal; font-size:11px;">(KKM: ${m.kkm})</small></th>`;
    });

    headerHTML += `
            <th class="bg-absensi" style="width:60px;">Sakit</th>
            <th class="bg-absensi" style="width:60px;">Izin</th>
            <th class="bg-absensi" style="width:60px;">Alpha</th>
        </tr>
    `;
    thead.innerHTML = headerHTML;

    // Baris Spreadsheet Santri
    listSantriKelas.forEach((santri, idx) => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-nis', santri.nis);

        let rowHTML = `
            <td style="text-align:center;">${idx + 1}</td>
            <td style="text-align:center;">${santri.nis}</td>
            <td><strong>${santri.nama}</strong></td>
        `;

        mapelList.forEach(m => {
            const nilVal = santri.nilai?.[m.nama] !== undefined ? santri.nilai[m.nama] : 0;
            rowHTML += `
                <td style="text-align:center;">
                    <input type="number" class="input-sheet-nilai" data-mapel="${m.nama}" value="${nilVal}" min="0" max="100">
                </td>
            `;
        });

        rowHTML += `
            <td class="bg-absensi" style="text-align:center;">
                <input type="number" class="input-sheet-sakit" value="${santri.kehadiran?.S || 0}" min="0">
            </td>
            <td class="bg-absensi" style="text-align:center;">
                <input type="number" class="input-sheet-izin" value="${santri.kehadiran?.I || 0}" min="0">
            </td>
            <td class="bg-absensi" style="text-align:center;">
                <input type="number" class="input-sheet-alpha" value="${santri.kehadiran?.A || 0}" min="0">
            </td>
        `;

        tr.innerHTML = rowHTML;
        tbody.appendChild(tr);
    });
}

async function simpanSemuaNilaiSpreadsheet() {
    const kelas = document.getElementById('select-kelas-nilai')?.value;
    if (!kelas) return alert("Pilih kelas terlebih dahulu!");

    const rows = document.querySelectorAll('#tbody-spreadsheet tr');
    if (rows.length === 0) return alert("Tidak ada data untuk disimpan!");

    alert("Menyimpan semua nilai kelas...");

    for (let tr of rows) {
        const nis = tr.getAttribute('data-nis');
        if (!nis) continue;

        const santriObj = DATA_SANTRI.find(s => s.nis === nis);
        if (!santriObj) continue;

        let objNilai = {};
        tr.querySelectorAll('.input-sheet-nilai').forEach(inp => {
            const mapel = inp.getAttribute('data-mapel');
            objNilai[mapel] = parseInt(inp.value) || 0;
        });

        const sakit = parseInt(tr.querySelector('.input-sheet-sakit')?.value) || 0;
        const izin = parseInt(tr.querySelector('.input-sheet-izin')?.value) || 0;
        const alpha = parseInt(tr.querySelector('.input-sheet-alpha')?.value) || 0;

        santriObj.nilai = objNilai;
        santriObj.kehadiran = { S: sakit, I: izin, A: alpha };

        const payload = {
            action: "saveNilai",
            nis: nis, nama: santriObj.nama, wali: santriObj.wali, kelas: kelas,
            sakit: sakit, izin: izin, alpha: alpha, nilai: objNilai
        };

        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: "POST", mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.error("Gagal simpan NIS:", nis);
        }
    }

    alert("Semua nilai kelas berhasil disimpan!");
    loadDataFromCloud();
}

// ===================================================
// KELOLA MAPEL & KKM
// ===================================================
function renderMapelTable() {
    const kelas = document.getElementById('select-kelas-mapel')?.value;
    const tableBody = document.getElementById('tbody-mapel');
    if (!tableBody || !kelas) return;

    tableBody.innerHTML = '';
    const mapelList = MAPEL_PER_KELAS[kelas] || [];

    mapelList.forEach((mapel, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><input type="text" class="form-control" value="${mapel.nama}" onchange="updateMapelLocal('${kelas}', ${index}, 'nama', this.value)"></td>
            <td><input type="number" class="form-control" value="${mapel.kkm}" onchange="updateMapelLocal('${kelas}', ${index}, 'kkm', this.value)"></td>
            <td><button type="button" class="btn-danger" onclick="hapusMapel('${kelas}', ${index})"><i class="fa-solid fa-trash"></i> Hapus</button></td>
        `;
        tableBody.appendChild(tr);
    });
}

function updateMapelLocal(kelas, index, field, val) {
    if (!MAPEL_PER_KELAS[kelas]) MAPEL_PER_KELAS[kelas] = [];
    if (field === 'kkm') val = parseInt(val) || 0;
    MAPEL_PER_KELAS[kelas][index][field] = val;
}

function tambahMapelRow() {
    const kelas = document.getElementById('select-kelas-mapel').value;
    if (!kelas) return alert("Pilih kelas terlebih dahulu");
    if (!MAPEL_PER_KELAS[kelas]) MAPEL_PER_KELAS[kelas] = [];
    MAPEL_PER_KELAS[kelas].push({ nama: "مادة جديدة", kkm: 70 });
    renderMapelTable();
}

function hapusMapel(kelas, index) {
    if (confirm("Hapus mata pelajaran ini?")) {
        MAPEL_PER_KELAS[kelas].splice(index, 1);
        renderMapelTable();
    }
}

async function simpanMapelKeCloud() {
    const kelas = document.getElementById('select-kelas-mapel').value;
    const listMapel = MAPEL_PER_KELAS[kelas] || [];

    localStorage.setItem('MAPEL_PER_KELAS', JSON.stringify(MAPEL_PER_KELAS));

    const payload = { action: "saveMapel", kelas: kelas, listMapel: listMapel };

    try {
        alert("Menyimpan Mapel...");
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        alert("Mapel berhasil disinkronkan!");
        loadDataFromCloud();
    } catch (err) {
        alert("Gagal menyinkronkan Mapel.");
    }
}

// ===================================================
// CETAK RAPORT & PREVIEW A4 FORMAT
// ===================================================
function loadSantriCetakDropdown() {
    const selectKelas = document.getElementById('select-kelas-cetak');
    const selectSantri = document.getElementById('select-santri-cetak');
    if (!selectSantri || !selectKelas) return;

    const kelas = selectKelas.value;
    selectSantri.innerHTML = '<option value="">-- Pilih Santri --</option>';

    const listFiltered = DATA_SANTRI.filter(s => s.kelas === kelas);
    listFiltered.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.nis;
        opt.textContent = `${s.nis} - ${s.nama}`;
        selectSantri.appendChild(opt);
    });

    tampilkanPreviewIndividual();
}

// Hitung Rata-Rata Nilai Kelas per Mapel (Kolom العامة)
function hitungRataRataKelasPerMapel(kelas) {
    const listSantriKelas = DATA_SANTRI.filter(s => s.kelas === kelas);
    const mapelList = MAPEL_PER_KELAS[kelas] || [];
    let rataRataMapel = {};

    mapelList.forEach(m => {
        let totalNilaiMapel = 0;
        let countSantri = 0;

        listSantriKelas.forEach(santri => {
            if (santri.nilai && santri.nilai[m.nama] !== undefined) {
                totalNilaiMapel += parseFloat(santri.nilai[m.nama]) || 0;
                countSantri++;
            }
        });

        rataRataMapel[m.nama] = countSantri > 0 ? (totalNilaiMapel / countSantri).toFixed(1) : 0;
    });

    return rataRataMapel;
}

// Generate HTML Raport Fisik (Format Arab Berdasarkan Desain)
function generateHTMLRaport(santri) {
    const mapelList = MAPEL_PER_KELAS[santri.kelas] || [];
    const rataRataKelasMapel = hitungRataRataKelasPerMapel(santri.kelas);

    let tbodyRows = '';
    let totalNilaiSantri = 0;

    mapelList.forEach((m, idx) => {
        const kkm = parseInt(m.kkm) || 70;
        const nilaiSantri = santri.nilai?.[m.nama] !== undefined ? parseInt(santri.nilai[m.nama]) : 0;
        const nilaiRataKelas = rataRataKelasMapel[m.nama] || '-';

        totalNilaiSantri += nilaiSantri;

        // Cek apakah nilai santri di bawah KKM
        const isDibawahKKM = nilaiSantri < kkm;
        const classNilaiKhusus = isDibawahKKM ? 'nilai-dibawah-kkm' : '';

        tbodyRows += `
            <tr>
                <td style="width: 35px;">${idx + 1}</td>
                <td class="mapel-name">${m.nama}</td>
                <td style="width: 60px;">${kkm}</td>
                <td style="width: 80px;" class="${classNilaiKhusus}">${nilaiSantri}</td>
                <td style="width: 80px;">${nilaiRataKelas}</td>
            </tr>
        `;
    });

    const sakit = santri.kehadiran?.S || 0;
    const izin = santri.kehadiran?.I || 0;
    const alpha = santri.kehadiran?.A || 0;

    return `
        <div class="raport-page">
            <!-- Kop Raport -->
            <div class="raport-kop">
                <img src="logo.png" alt="Logo" class="raport-logo" onerror="this.style.display='none'">
                <div class="raport-title-main">كشف الدرجات الدراسية</div>
                <div class="raport-subtitle-ar">المدرسة الدينية دار الحكمة</div>
                <div class="raport-address-ar">بالينرجو - بالين - بوجونجارا</div>
                <div class="raport-year-ar">السنة الدراسية: ١٤٤٦-١٤٤٧ هـ / ٢٠٢٥-٢٠٢٦ م</div>
            </div>

            <!-- Identitas Santri -->
            <table class="raport-biodata">
                <tr>
                    <td style="width: 15%;"><strong>Nama</strong></td>
                    <td style="width: 45%;">: ${santri.nama}</td>
                    <td style="width: 15%;"><strong>Ruang</strong></td>
                    <td style="width: 25%;">: A</td>
                </tr>
                <tr>
                    <td><strong>Kelas</strong></td>
                    <td>: ${santri.kelas}</td>
                    <td><strong>Semester</strong></td>
                    <td>: Ganjil</td>
                </tr>
            </table>

            <!-- Tabel Nilai Utama -->
            <table class="raport-main-table">
                <thead>
                    <tr>
                        <th rowspan="2" style="width: 35px;">الرقم</th>
                        <th rowspan="2">الكتب الدراسية</th>
                        <th rowspan="2" style="width: 60px;">KKM</th>
                        <th colspan="2">أرقام الدرجات الدراسية الخاصة والعامة</th>
                    </tr>
                    <tr>
                        <th style="width: 80px;">الخاصة</th>
                        <th style="width: 80px;">العامة</th>
                    </tr>
                </thead>
                <tbody>
                    ${tbodyRows}
                    <!-- Baris Total Nilai -->
                    <tr>
                        <td colspan="3" style="text-align: center; font-family:'Amiri', serif; font-size:15px; font-weight:bold;">جملة أرقام الدرجة الدراسية</td>
                        <td colspan="2" style="font-weight: bold;">${totalNilaiSantri}</td>
                    </tr>
                    <!-- Baris Peringkat Kelas -->
                    <tr>
                        <td colspan="3" style="text-align: center; font-family:'Amiri', serif; font-size:15px; font-weight:bold;">درجة الفصل</td>
                        <td colspan="2">-</td>
                    </tr>
                    <!-- Baris Peringkat Umum -->
                    <tr>
                        <td colspan="3" style="text-align: center; font-family:'Amiri', serif; font-size:15px; font-weight:bold;">درجة العام</td>
                        <td colspan="2">-</td>
                    </tr>
                    <!-- Baris Absensi / Ketidakhadiran -->
                    <tr>
                        <td rowspan="3" colspan="2" style="vertical-align: middle; font-family:'Amiri', serif; font-size:16px; font-weight:bold;">المواظبة</td>
                        <td style="font-family:'Amiri', serif;">مريض</td>
                        <td colspan="2">${sakit}</td>
                    </tr>
                    <tr>
                        <td style="font-family:'Amiri', serif;">إذن</td>
                        <td colspan="2">${izin}</td>
                    </tr>
                    <tr>
                        <td style="font-family:'Amiri', serif;">بلا إذن</td>
                        <td colspan="2">${alpha}</td>
                    </tr>
                </tbody>
            </table>

            <!-- Area Tanda Tangan -->
            <table class="raport-signatures">
                <tr>
                    <td>
                        <div class="sig-title">الولي</div>
                        <div class="sig-name">${santri.wali || 'MZ. ARIFIN'}</div>
                    </td>
                    <td>
                        <div class="sig-title">رئيس المدرسة</div>
                        <div class="sig-name">Moh. Nur Huda</div>
                    </td>
                    <td>
                        <div class="sig-title">المدرس / طة</div>
                        <div class="sig-name">Wahyu Yahya Andika</div>
                    </td>
                </tr>
            </table>
        </div>
    `;
}

// Menampilkan Preview Individu
function tampilkanPreviewIndividual() {
    const selectSantri = document.getElementById('select-santri-cetak');
    const printArea = document.getElementById('print-area');
    
    if (!selectSantri || !printArea) return;

    const nis = selectSantri.value;
    if (!nis) {
        printArea.innerHTML = `
            <div style="text-align:center; padding: 40px; color:#64748b; background:#fff; border-radius:8px;">
                <i class="fa-solid fa-file-invoice" style="font-size: 48px; margin-bottom: 10px;"></i>
                <p>Silakan pilih Kelas dan Santri di atas untuk menampilkan review raport.</p>
            </div>
        `;
        return;
    }

    const santri = DATA_SANTRI.find(s => String(s.nis) === String(nis));
    
    if (santri) {
        printArea.innerHTML = generateHTMLRaport(santri);
    } else {
        printArea.innerHTML = `<div style="text-align:center; padding: 20px; color: red;">Data santri tidak ditemukan.</div>`;
    }
}

// Cetak Raport 1 Santri
function cetakRaportSatu() {
    const selectSantri = document.getElementById('select-santri-cetak');
    if (!selectSantri || !selectSantri.value) {
        alert('Silakan pilih santri terlebih dahulu!');
        return;
    }
    tampilkanPreviewIndividual();
    window.print();
}

// Cetak Raport Massal 1 Kelas
function cetakRaportSatuKelas() {
    const selectKelas = document.getElementById('select-kelas-cetak');
    const printArea = document.getElementById('print-area');

    if (!selectKelas || !selectKelas.value) {
        alert('Silakan pilih kelas terlebih dahulu!');
        return;
    }

    const kelas = selectKelas.value;
    const listSantriKelas = DATA_SANTRI.filter(s => s.kelas === kelas);

    if (listSantriKelas.length === 0) {
        alert('Tidak ada santri di kelas ini.');
        return;
    }

    let htmlAll = '';
    listSantriKelas.forEach(santri => {
        htmlAll += generateHTMLRaport(santri);
    });

    printArea.innerHTML = htmlAll;
    
    setTimeout(() => {
        window.print();
    }, 300);
}