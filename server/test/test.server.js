import supertest from "supertest";
import { app } from "../server.js";
import { expect } from "chai";
import upload from "../middleware/uploadMiddleware.js";

describe("Authentication tests", () => {
    it("should login a user", async () => {
        const response = await supertest(app)
            .post("/api/users/login")
            .send({
                email: "lesliemabah6@gmail.com",
                password: "Leslie0525!"
            });
        expect(response.status).to.equal(200);

        console.log("Login response:", response.body);
    });

   
    it("should create a task", async () => {
        const loginResponse = await supertest(app)
            .post("/api/users/login")
            .send({
                email: "ndakwahashbel@gmail.com",
                password: "Anih0525!"
            });

        expect(loginResponse.status).to.equal(200);

        const token = loginResponse.body.token;

        const response = await supertest(app)
            .post("/api/supervisor/tasks")
            .set("Authorization", `Bearer ${token}`)
            .send({
                studentId: 4,
                title: "Test Task",
                description: "This is a test task"
            });

        console.log("Task status:", response.status);
        console.log("Task response:", response.body);

        expect(response.status).to.equal(201);
    });

    it("should create a new user by admin", async () => {
        // 1. Login as admin
        const loginResponse = await supertest(app)
            .post("/api/users/login")
            .send({
                email: "foucheamida@gmail.com",
                password: "dady12345"
            });

        console.log("Admin login status:", loginResponse.status);
        console.log("Admin login response:", loginResponse.body);

        expect(loginResponse.status).to.equal(200);

        // 2. Get admin JWT token
        const token = loginResponse.body.token;

        // 3. Create a new user
        const response = await supertest(app)
            .post("/api/admin/users")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Test Student",
                email: "teststudent@gmail.com",
                role: "student",
                matricule: "TEST2026",
                class: "Software Engineering 2"
            });

        console.log("User creation status:", response.status);
        console.log("User creation response:", response.body);

        // 4. Verify successful creation
        expect(response.status).to.equal(201);
    });

    it("should create a new meeting by academic supervisor", async function () {
        this.timeout(10000);

        const loginResponse = await supertest(app)
            .post("/api/users/login")
            .send({
                email: "ndakwahashbel@gmail.com",
                password: "Anih0525!"
            });

        console.log("Supervisor login status:", loginResponse.status);
        console.log("Supervisor login response:", loginResponse.body);

        expect(loginResponse.status).to.equal(200);
        expect(loginResponse.body.user.role).to.equal("academic_supervisor");

        const token = loginResponse.body.token;

        const response = await supertest(app)
            .post("/api/meetings/schedule")
            .set("Authorization", `Bearer ${token}`)
            .send({
                studentId: 1, // must be assigned to this supervisor
                title: "Internship Progress Meeting",
                description: "Discussion about internship progress",
                date: "2027-01-15T10:00:00",
                location: "AICS Cameroon"
            });

        console.log("Meeting creation status:", response.status);
        console.log("Meeting creation response:", response.body);

        expect(response.status).to.equal(201);
        expect(response.body.message).to.equal(
            "Meeting scheduled successfully"
        );
        expect(response.body.meeting).to.exist;
    });
})
