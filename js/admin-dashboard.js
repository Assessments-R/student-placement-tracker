const welcomeMessage = document.getElementById("welcomeMessage");
const dashboardMessage = document.getElementById("dashboardMessage");
const logoutButton = document.getElementById("logoutButton");

async function verifyStaffAccess() {
    const {
        data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.replace("login.html");
        return null;
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
        return null;
    }

    welcomeMessage.textContent =
        `Welcome, ${profile.full_name} — ${profile.role}`;

    return profile;
}

async function loadDashboardStatistics() {
    const [
        studentsResult,
        offersResult,
        drivesResult
    ] = await Promise.all([
        supabaseClient
            .from("students")
            .select("*", { count: "exact", head: true }),

        supabaseClient
            .from("placement_offers")
            .select("student_id"),

        supabaseClient
            .from("placement_drives")
            .select("*", { count: "exact", head: true })
            .in("drive_status", [
                "Upcoming",
                "Registration Open",
                "In Progress"
            ])
    ]);

    const error =
        studentsResult.error ||
        offersResult.error ||
        drivesResult.error;

    if (error) {
        dashboardMessage.textContent =
            "Unable to load dashboard statistics.";
        return;
    }

    const placedStudentIds = new Set(
        (offersResult.data || []).map(offer => offer.student_id)
    );

    document.getElementById("totalStudents").textContent =
        studentsResult.count ?? 0;

    document.getElementById("placedStudents").textContent =
        placedStudentIds.size;

    document.getElementById("totalOffers").textContent =
        offersResult.data?.length ?? 0;

    document.getElementById("upcomingDrives").textContent =
        drivesResult.count ?? 0;
}

logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.replace("login.html");
});

async function initialiseDashboard() {
    const profile = await verifyStaffAccess();

    if (profile) {
        await loadDashboardStatistics();
    }
}

initialiseDashboard();
