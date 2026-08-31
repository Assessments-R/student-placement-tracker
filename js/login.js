const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";
    loginMessage.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (error) {
            throw error;
        }

        const { data: profile, error: profileError } =
            await supabaseClient
                .from("user_profiles")
                .select("full_name, role, is_active")
                .eq("id", data.user.id)
                .single();

        if (profileError) {
            throw new Error("Your user profile could not be found.");
        }

        if (!profile.is_active) {
            await supabaseClient.auth.signOut();
            throw new Error("This account has been disabled.");
        }

        if (
            profile.role !== "Administrator" &&
            profile.role !== "Placement Staff"
        ) {
            await supabaseClient.auth.signOut();
            throw new Error("You do not have staff access.");
        }

        window.location.href = "admin-dashboard.html";

    } catch (error) {
        loginMessage.textContent =
            error.message || "Unable to sign in.";
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Sign In";
    }
});
