const driveForm = document.getElementById("driveForm");
const driveTableBody = document.getElementById("driveTableBody");
const driveSearch = document.getElementById("driveSearch");
const driveCount = document.getElementById("driveCount");
const driveFormMessage = document.getElementById("driveFormMessage");
const saveDriveButton = document.getElementById("saveDriveButton");
const cancelDriveEditButton =
    document.getElementById("cancelDriveEditButton");
const welcomeMessage = document.getElementById("welcomeMessage");
const logoutButton = document.getElementById("logoutButton");

let driveRecords = [];

function numberOrNull(value) {
    return value === "" ? null : Number(value);
}

function dateTimeOrNull(value) {
    return value ? new Date(value).toISOString() : null;
}

async function verifyStaffAccess() {
    const {
        data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.replace("login.html");
        return false;
    }

    const { data: profile, error } = await supabaseClient
        .from("user_profiles")
        .select("full_name, role, is_active")
        .eq("id", session.user.id)
        .single();

    if (
        error ||
        !profile ||
        !profile.is_active ||
        !["Administrator", "Placement Staff"].includes(profile.role)
    ) {
        await supabaseClient.auth.signOut();
        window.location.replace("login.html");
        return false;
    }

    welcomeMessage.textContent =
        `Welcome, ${profile.full_name} — ${profile.role}`;

    return true;
}

async function findOrCreateCompany(companyName) {
    const cleanedName = companyName.trim();

    const { data: existingCompany, error: searchError } =
        await supabaseClient
            .from("companies")
            .select("id, company_name")
            .ilike("company_name", cleanedName)
            .maybeSingle();

    if (searchError) {
        throw searchError;
    }

    if (existingCompany) {
        return existingCompany;
    }

    const { data: newCompany, error: insertError } =
        await supabaseClient
            .from("companies")
            .insert({
                company_name: cleanedName,
                updated_at: new Date().toISOString()
            })
            .select("id, company_name")
            .single();

    if (insertError) {
        throw insertError;
    }

    return newCompany;
}

function getDriveFormData(companyId) {
    const branchText =
        document.getElementById("eligibleBranches").value.trim();

    const branches = branchText
        ? branchText
            .split(",")
            .map(branch => branch.trim())
            .filter(Boolean)
        : null;

    return {
        company_id: companyId,
        drive_name:
            document.getElementById("driveName").value.trim(),
        job_role:
            document.getElementById("jobRole").value.trim(),
        job_location:
            document.getElementById("jobLocation").value.trim() || null,
        employment_type:
            document.getElementById("employmentType").value,
        package_lpa:
            numberOrNull(document.getElementById("packageLpa").value),
        minimum_tenth_percentage:
            numberOrNull(document.getElementById("minimumTenth").value),
        minimum_inter_percentage:
            numberOrNull(document.getElementById("minimumInter").value),
        minimum_btech_cgpa:
            numberOrNull(document.getElementById("minimumCgpa").value),
        maximum_backlogs:
            Number(
                document.getElementById("maximumBacklogs").value || 0
            ),
        eligible_branches: branches,
        drive_date:
            document.getElementById("driveDate").value || null,
        registration_deadline:
            dateTimeOrNull(
                document.getElementById("registrationDeadline").value
            ),
        drive_mode:
            document.getElementById("driveMode").value,
        drive_status:
            document.getElementById("driveStatus").value,
        description:
            document.getElementById("driveDescription").value.trim()
            || null,
        updated_at: new Date().toISOString()
    };
}

async function loadDrives() {
    driveTableBody.innerHTML =
        `<tr><td colspan="8">Loading placement drives...</td></tr>`;

    const { data, error } = await supabaseClient
        .from("placement_drives")
        .select(`
            *,
            companies (
                id,
                company_name
            )
        `)
        .order("drive_date", {
            ascending: false,
            nullsFirst: false
        });

    if (error) {
        driveTableBody.innerHTML =
            `<tr><td colspan="8">Unable to load placement drives.</td></tr>`;
        return;
    }

    driveRecords = data || [];
    displayDrives(driveRecords);
}

function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "—";
    row.appendChild(cell);
}

function formatDate(value) {
    if (!value) {
        return "—";
    }

    return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN");
}

function displayDrives(records) {
    driveTableBody.replaceChildren();

    driveCount.textContent =
        `${records.length} drive${records.length === 1 ? "" : "s"} found`;

    if (records.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 8;
        cell.textContent = "No placement drives found.";

        row.appendChild(cell);
        driveTableBody.appendChild(row);
        return;
    }

    records.forEach(drive => {
        const row = document.createElement("tr");

        addCell(row, drive.companies?.company_name);
        addCell(row, drive.drive_name);
        addCell(row, drive.job_role);

        addCell(
            row,
            drive.package_lpa !== null
                ? `${drive.package_lpa} LPA`
                : "—"
        );

        addCell(row, formatDate(drive.drive_date));
        addCell(row, drive.drive_mode);
        addCell(row, drive.drive_status);

        const actionCell = document.createElement("td");
        const editButton = document.createElement("button");

        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.addEventListener(
            "click",
            () => beginDriveEdit(drive.id)
        );

        actionCell.appendChild(editButton);
        row.appendChild(actionCell);
        driveTableBody.appendChild(row);
    });
}

function beginDriveEdit(driveId) {
    const drive = driveRecords.find(
        record => record.id === Number(driveId)
    );

    if (!drive) {
        return;
    }

    document.getElementById("driveRecordId").value = drive.id;
    document.getElementById("companyRecordId").value =
        drive.companies?.id ?? "";

    document.getElementById("companyName").value =
        drive.companies?.company_name ?? "";
    document.getElementById("driveName").value =
        drive.drive_name ?? "";
    document.getElementById("jobRole").value =
        drive.job_role ?? "";
    document.getElementById("jobLocation").value =
        drive.job_location ?? "";
    document.getElementById("packageLpa").value =
        drive.package_lpa ?? "";
    document.getElementById("driveDate").value =
        drive.drive_date ?? "";
    document.getElementById("minimumTenth").value =
        drive.minimum_tenth_percentage ?? "";
    document.getElementById("minimumInter").value =
        drive.minimum_inter_percentage ?? "";
    document.getElementById("minimumCgpa").value =
        drive.minimum_btech_cgpa ?? "";
    document.getElementById("maximumBacklogs").value =
        drive.maximum_backlogs ?? 0;
    document.getElementById("eligibleBranches").value =
        drive.eligible_branches?.join(", ") ?? "";
    document.getElementById("driveMode").value =
        drive.drive_mode ?? "On Campus";
    document.getElementById("driveStatus").value =
        drive.drive_status ?? "Upcoming";
    document.getElementById("employmentType").value =
        drive.employment_type ?? "Full Time";
    document.getElementById("driveDescription").value =
        drive.description ?? "";

    if (drive.registration_deadline) {
        const date = new Date(drive.registration_deadline);
        const localDate = new Date(
            date.getTime() - date.getTimezoneOffset() * 60000
        );

        document.getElementById("registrationDeadline").value =
            localDate.toISOString().slice(0, 16);
    } else {
        document.getElementById("registrationDeadline").value = "";
    }

    document.getElementById("formTitle").textContent =
        "Edit Placement Drive";
    saveDriveButton.textContent = "Update Drive";
    cancelDriveEditButton.hidden = false;
    driveFormMessage.textContent = "";

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetDriveForm() {
    driveForm.reset();
    document.getElementById("driveRecordId").value = "";
    document.getElementById("companyRecordId").value = "";
    document.getElementById("maximumBacklogs").value = 0;
    document.getElementById("driveMode").value = "On Campus";
    document.getElementById("driveStatus").value = "Draft";
    document.getElementById("employmentType").value = "Full Time";
    document.getElementById("formTitle").textContent =
        "Create Placement Drive";
    saveDriveButton.textContent = "Save Drive";
    cancelDriveEditButton.hidden = true;
}

driveForm.addEventListener("submit", async event => {
    event.preventDefault();

    saveDriveButton.disabled = true;
    driveFormMessage.className = "status-message";
    driveFormMessage.textContent = "Saving placement drive...";

    try {
        const company = await findOrCreateCompany(
            document.getElementById("companyName").value
        );

        const driveId =
            document.getElementById("driveRecordId").value;

        const driveData = getDriveFormData(company.id);

        let result;

        if (driveId) {
            result = await supabaseClient
                .from("placement_drives")
                .update(driveData)
                .eq("id", driveId);
        } else {
            result = await supabaseClient
                .from("placement_drives")
                .insert(driveData);
        }

        if (result.error) {
            throw result.error;
        }

        resetDriveForm();

        driveFormMessage.className =
            "status-message success-message";
        driveFormMessage.textContent =
            driveId
                ? "Placement drive updated successfully."
                : "Placement drive created successfully.";

        await loadDrives();

    } catch (error) {
        driveFormMessage.className =
            "status-message error-message";
        driveFormMessage.textContent =
            `Unable to save drive: ${error.message}`;

    } finally {
        saveDriveButton.disabled = false;
    }
});

driveSearch.addEventListener("input", () => {
    const searchTerm = driveSearch.value.trim().toLowerCase();

    if (!searchTerm) {
        displayDrives(driveRecords);
        return;
    }

    const filteredRecords = driveRecords.filter(drive => {
        return [
            drive.companies?.company_name,
            drive.drive_name,
            drive.job_role,
            drive.drive_status,
            drive.drive_mode
        ].some(value =>
            String(value || "").toLowerCase().includes(searchTerm)
        );
    });

    displayDrives(filteredRecords);
});

cancelDriveEditButton.addEventListener("click", () => {
    resetDriveForm();
    driveFormMessage.textContent = "";
});

logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.replace("login.html");
});

async function initialiseDrivePage() {
    const hasAccess = await verifyStaffAccess();

    if (hasAccess) {
        await loadDrives();
    }
}

initialiseDrivePage();
