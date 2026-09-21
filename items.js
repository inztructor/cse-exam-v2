// =========================================================
// 1. EXAM ENGINE & STATE MANAGEMENT (3 MODES SUPPORTED)
// =========================================================

let currentExamMode = 1; // 1 = Mock Exam (Timed), 2 = Subtopic Practice (Untimed), 3 = Interactive Tutor (Instant Feedback)
let currentExam = [];
let currentIndex = 0;
let userAnswers = {};
let totalSeconds = 3 * 60 * 60;
let timerInterval = null;


// Fisher-Yates Shuffle
function shuffleArray(arr) {
    let array = [...arr];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Subtopics where option order AND question sequence remain strictly fixed
const fixedOptionSubtopics = [
    "Data Sufficiency",
    "Identifying Errors",
    "Paragraph Development",
	"Reading Comprehension",
    "Pagkilala sa Mali",
    "Pag-unawa sa Binasa",
    "Pagtatalata"
];

/**
 * Retrieves questions matching 'subtopicName' by checking both q.subtopic and q.subject.
 * If 'count' is null or undefined, retrieves ALL questions matching that category.
 */
function getSubtopicQuestions(pool, subtopicName, count = null) {
    if (!pool || !Array.isArray(pool) || !subtopicName) return [];

    const targetSub = subtopicName.trim().toLowerCase();

    // Flexible Filter: Checks both subtopic and subject attributes safely
    const filtered = pool.filter(q => {
        const sub = (q.subtopic || "").trim().toLowerCase();
        const subj = (q.subject || "").trim().toLowerCase();
        return sub === targetSub || subj === targetSub;
    });

    if (filtered.length === 0) {
        console.warn(`[Warning] No questions found for category: "${subtopicName}".`);
        return [];
    }

    if (count !== null && filtered.length < count) {
        console.warn(`[Warning] Category "${subtopicName}" requested ${count} items, but found ${filtered.length}.`);
    }

    const shouldKeepOptionsFixed = fixedOptionSubtopics.map(s => s.toLowerCase()).includes(targetSub);

    // Take questions sequentially if fixed, otherwise shuffle randomly
    const targetCount = count !== null ? count : filtered.length;
    const selectedQuestions = shouldKeepOptionsFixed 
        ? filtered.slice(0, targetCount) 
        : shuffleArray(filtered).slice(0, targetCount);

    // Return selected questions with conditional option shuffling
    return selectedQuestions.map(q => {
        if (shouldKeepOptionsFixed) {
            return {
                ...q,
                options: [...q.options],
                correct: q.correct
            };
        } else {
            const correctAnswerText = q.options[q.correct];
            const shuffledOptions = shuffleArray(q.options);
            const newCorrectIndex = shuffledOptions.indexOf(correctAnswerText);

            return {
                ...q,
                options: shuffledOptions,
                correct: newCorrectIndex
            };
        }
    });
}

// Helper: Aggregates all global pools into one array for Mode 2 & Mode 3 searching
function getMasterPool() {
    let combined = [];
    if (typeof numericalPool !== 'undefined') combined.push(...numericalPool);
    if (typeof verbalPool !== 'undefined') combined.push(...verbalPool);
    if (typeof analyticalPool !== 'undefined') combined.push(...analyticalPool);
    if (typeof generalInfoPool !== 'undefined') combined.push(...generalInfoPool);
    return combined;
}

// Generates the Full 150-question exam in EXACT sub-topic order (Mode 1)
function generate150QuestionExam() {
    let examPool = [];

    // 1. NUMERICAL ABILITY (42 Items Total)
    if (typeof numericalPool !== 'undefined') {
        examPool.push(...getSubtopicQuestions(numericalPool, "Word Problems and Operations", 25));
        examPool.push(...getSubtopicQuestions(numericalPool, "Data Sufficiency", 17));
    }

    // 2. VERBAL ABILITY (55 Items Total)
    if (typeof verbalPool !== 'undefined') {
        examPool.push(...getSubtopicQuestions(verbalPool, "Alphabetizing", 5));
        examPool.push(...getSubtopicQuestions(verbalPool, "Synonyms", 5));
        examPool.push(...getSubtopicQuestions(verbalPool, "Antonyms", 5));
        examPool.push(...getSubtopicQuestions(verbalPool, "Single-Word Analogy", 5));
        examPool.push(...getSubtopicQuestions(verbalPool, "Double-Word Analogy", 5));
        examPool.push(...getSubtopicQuestions(verbalPool, "Identifying Errors", 5));
        examPool.push(...getSubtopicQuestions(verbalPool, "Paragraph Development", 5));
        examPool.push(...getSubtopicQuestions(verbalPool, "Correct Usage", 5));
        examPool.push(...getSubtopicQuestions(verbalPool, "Reading Comprehension", 5));
        
        // Filipino Sub-Topics
        examPool.push(...getSubtopicQuestions(verbalPool, "Kasingkahulugan", 3));
        examPool.push(...getSubtopicQuestions(verbalPool, "Kasalungat", 3));
        examPool.push(...getSubtopicQuestions(verbalPool, "Mga Kawikaan", 3));
        examPool.push(...getSubtopicQuestions(verbalPool, "Wastong Gamit", 3));
        examPool.push(...getSubtopicQuestions(verbalPool, "Pagkilala sa Mali", 3));
    }

    // 3. ANALYTICAL ABILITY (35 Items Total)
    if (typeof analyticalPool !== 'undefined') {
        examPool.push(...getSubtopicQuestions(analyticalPool, "Inductive Reasoning", 20));
        examPool.push(...getSubtopicQuestions(analyticalPool, "Abstract Reasoning", 15));
    }

    // 4. GENERAL INFORMATION (18 Items Total)
    if (typeof generalInfoPool !== 'undefined') {
        examPool.push(...getSubtopicQuestions(generalInfoPool, "Philippine Constitution", 18));
    }

    return examPool;
}

/**
 * Main Controller to start any exam mode.
 * @param {number} mode - 1 (Mock Exam), 2 (Practice Test), 3 (Tutor Mode)
 * @param {string|null} subtopicName - Specific subtopic for Mode 2 or 3
 * @param {number|null} itemCount - Optional limit on number of items to load
 */
function startExamMode(mode = 1, subtopicName = null, itemCount = null) {
    currentExamMode = mode;
    currentIndex = 0;
    userAnswers = {};

    // Reset UI visibility
    const resultBox = document.getElementById("result-box");
    if (resultBox) resultBox.style.display = "none";
    
    const quizBox = document.getElementById("quiz-card-box");
    if (quizBox) quizBox.style.display = "block";

    const timerBox = document.getElementById("timer-box");

    if (mode === 1) {
        // Mode 1: Full Timed Exam
        currentExam = generate150QuestionExam();
        if (timerBox) timerBox.style.display = "block";
        startTimer();
    } else {
        // Modes 2 & 3: Untimed, Sub-topic selection
        if (timerInterval) clearInterval(timerInterval);
        if (timerBox) timerBox.style.display = "none";

        const masterPool = getMasterPool();
        if (subtopicName) {
            currentExam = getSubtopicQuestions(masterPool, subtopicName, itemCount);
            // Fallback if requested subtopic has no matches
            if (currentExam.length === 0) {
                console.warn(`Fallback triggered: loading all available questions for ${subtopicName}`);
                currentExam = masterPool;
            }
        } else {
            currentExam = itemCount ? shuffleArray(masterPool).slice(0, itemCount) : shuffleArray(masterPool);
        }
    }

    renderCurrentQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =========================================================
// 2. RENDERING & UI FUNCTIONS
// =========================================================

function renderCurrentQuestion() {
    const total = currentExam.length;

    if (!currentExam || total === 0) {
        document.getElementById("question-text").innerHTML = "No questions found for the selected mode/subtopic.";
        return;
    }

    const q = currentExam[currentIndex];

    document.getElementById("q-counter-text").innerText = `Question ${currentIndex + 1} of ${total}`;
    const progressPercent = ((currentIndex + 1) / total) * 100;
    document.getElementById("progress-bar").style.width = `${progressPercent}%`;

    document.getElementById("topic-badge-text").innerText = `${q.subject || 'Practice'} — ${q.subtopic || 'General'}`;
    document.getElementById("direction-text").innerText = q.directions || "";
    
    let questionContent = `${currentIndex + 1}. ${q.question}`;
    if (q.image) {
        questionContent += `
            <div style="text-align:center; margin-top:15px;">
                <img src="${q.image}" alt="Question Figure" style="max-width:100%; max-height:300px; border-radius:8px; border:1px solid #cbd5e0; display:block; margin:0 auto;">
            </div>
        `;
    }
    document.getElementById("question-text").innerHTML = questionContent;

    const optionsContainer = document.getElementById("options-container");
    optionsContainer.innerHTML = "";

    const hasAnswered = userAnswers[currentIndex] !== undefined;

    q.options.forEach((optText, oIdx) => {
        const isSelected = userAnswers[currentIndex] === oIdx;
        const letterPrefix = String.fromCharCode(65 + oIdx);
        const optionLabel = document.createElement("label");

        let customClass = "option-card";
        if (isSelected) customClass += " selected";

        // Mode 3 Immediate Highlighting
        if (currentExamMode === 3 && hasAnswered) {
            if (oIdx === q.correct) {
                customClass += " correct-choice";
            } else if (isSelected && oIdx !== q.correct) {
                customClass += " incorrect-choice";
            }
        }

        optionLabel.className = customClass;
        const disabledAttr = (currentExamMode === 3 && hasAnswered) ? "disabled" : "";
        
        optionLabel.innerHTML = `
            <input type="radio" name="option_choice" value="${oIdx}" ${isSelected ? 'checked' : ''} ${disabledAttr} onchange="selectOption(${oIdx})">
            <span class="option-text"><strong>${letterPrefix}.</strong> ${optText}</span>
        `;
        optionsContainer.appendChild(optionLabel);
    });

    // Handle Mode 3 Instant Feedback Banner
    let feedbackBox = document.getElementById("instant-feedback-box");
    if (!feedbackBox) {
        feedbackBox = document.createElement("div");
        feedbackBox.id = "instant-feedback-box";
        optionsContainer.parentNode.insertBefore(feedbackBox, optionsContainer.nextSibling);
    }

    if (currentExamMode === 3 && hasAnswered) {
        const userChoice = userAnswers[currentIndex];
        const isCorrect = userChoice === q.correct;
        const explanationText = q.explanation || "No specific explanation provided for this question.";

        feedbackBox.style.display = "block";
        feedbackBox.className = `instant-feedback ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`;
        feedbackBox.innerHTML = `
            <div style="font-weight: bold; font-size: 1.05rem; margin-bottom: 6px;">
                ${isCorrect ? '🎉 Excellent! Correct Answer!' : '❌ That\'s Incorrect.'}
            </div>
            <div>${explanationText}</div>
        `;
    } else {
        feedbackBox.style.display = "none";
    }

    document.getElementById("prev-btn").style.visibility = currentIndex === 0 ? "hidden" : "visible";
    
    const nextBtn = document.getElementById("next-btn");
    if (currentIndex === total - 1) {
        if (currentExamMode === 3) {
            nextBtn.innerText = "Finish Practice Session";
            nextBtn.className = "btn btn-submit";
            nextBtn.onclick = finishTutorMode;
        } else {
            nextBtn.innerText = "Submit Exam";
            nextBtn.className = "btn btn-submit";
            nextBtn.onclick = submitExam;
        }
    } else {
        nextBtn.innerText = "Next →";
        nextBtn.className = "btn btn-next";
        nextBtn.onclick = () => navigateQuestion(1);
    }

    if (q.sidebarId) highlightSidebar(q.sidebarId);
}

function selectOption(optionIndex) {
    // Mode 3 locks answer after selection
    if (currentExamMode === 3 && userAnswers[currentIndex] !== undefined) return;

    userAnswers[currentIndex] = optionIndex;
    
    if (currentExamMode === 3) {
        // Re-render instantly to show feedback and explanations
        renderCurrentQuestion();
    } else {
        const cards = document.querySelectorAll(".option-card");
        cards.forEach((card, idx) => {
            if (idx === optionIndex) {
                card.classList.add("selected");
            } else {
                card.classList.remove("selected");
            }
        });
    }
}

function navigateQuestion(direction) {
    currentIndex += direction;
    if (currentIndex < 0) currentIndex = 0;
    if (currentIndex >= currentExam.length) currentIndex = currentExam.length - 1;
    renderCurrentQuestion();
}

function highlightSidebar(sidebarId) {
    document.querySelectorAll('.sidebar-menu li').forEach(el => el.classList.remove('active'));
    const activeEl = document.getElementById(sidebarId);
    if (activeEl) activeEl.classList.add('active');
}

// =========================================================
// 3. MOBILE SIDEBAR LOGIC
// =========================================================

function toggleMobileSidebar() {
    const sidebar = document.getElementById("sidebar-drawer");
    const overlay = document.getElementById("sidebar-overlay");
    if (sidebar) sidebar.classList.toggle("open");
    if (overlay) overlay.classList.toggle("active");
}

function closeSidebarOnMobile() {
    if (window.innerWidth <= 768) {
        toggleMobileSidebar();
    }
}

// =========================================================
// 4. TIMER LOGIC (MODE 1 ONLY)
// =========================================================

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    totalSeconds = 3 * 60 * 60;
    const timerElement = document.getElementById('timer');

    timerInterval = setInterval(() => {
        if (totalSeconds <= 0) {
            clearInterval(timerInterval);
            if (timerElement) timerElement.textContent = "00:00:00";
            alert("TIME IS UP");
            submitExam();
            return;
        }

        let hours = Math.floor(totalSeconds / 3600);
        let minutes = Math.floor((totalSeconds % 3600) / 60);
        let seconds = totalSeconds % 60;

        if (timerElement) {
            timerElement.textContent = 
                `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }

        totalSeconds--;
    }, 1000);
}

// =========================================================
// 5. SUBMISSION, REVIEW & FINISH LOGIC
// =========================================================

function submitExam() {
    if (timerInterval) clearInterval(timerInterval);
    let score = 0;

    currentExam.forEach((q, idx) => {
        if (userAnswers[idx] === q.correct) {
            score++;
        }
    });

    const total = currentExam.length;
    const percentage = total > 0 ? (score / total) * 100 : 0;

    document.getElementById("quiz-card-box").style.display = "none";
    const resultBox = document.getElementById("result-box");
    if (resultBox) resultBox.style.display = "block";

    document.getElementById("score-text").innerText = `${score} / ${total}`;
    document.getElementById("percentage-text").innerText = `Percentage: ${percentage.toFixed(2)}%`;

    const greetingEl = document.getElementById("greeting-message");

    if (percentage >= 95) {
        greetingEl.style.color = "#276749";
        greetingEl.innerHTML = "<strong>Outstanding Performance! 🎉</strong><br>Excellent mastery! You demonstrate complete preparedness for this section.";
    } else if (percentage >= 80) {
        greetingEl.style.color = "#2b6cb0";
        greetingEl.innerHTML = "<strong>Congratulations! You Passed! 👏</strong><br>Great job! You reached the required passing score of 80%. Keep reviewing to maintain your edge.";
    } else if (percentage >= 70) {
        greetingEl.style.color = "#dd6b20";
        greetingEl.innerHTML = "<strong>So Close! Almost Passed! ⚠️</strong><br>You are near the 80% mark. Focus on reviewing your weaker topics and try again.";
    } else {
        greetingEl.style.color = "#c53030";
        greetingEl.innerHTML = "<strong>Needs Improvement. 📚</strong><br>Do not give up! Review the subject materials carefully and re-attempt the test to build speed and accuracy.";
    }

    renderAnswerReview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function finishTutorMode() {
    alert("Great job completing your study session!");
    startExamMode(currentExamMode);
}

function renderAnswerReview() {
    const reviewContainer = document.getElementById("review-list-container");
    if (!reviewContainer) return;
    reviewContainer.innerHTML = "";

    currentExam.forEach((q, idx) => {
        const userSelectedIdx = userAnswers[idx];
        const isCorrect = userSelectedIdx === q.correct;

        const userAnsText = userSelectedIdx !== undefined ? q.options[userSelectedIdx] : "<em>No Answer Provided</em>";
        const correctAnsText = q.options[q.correct];

        let questionBody = `${idx + 1}. ${q.question}`;
        if (q.image) {
            questionBody += `<br><img src="${q.image}" alt="Question Figure" style="max-width:100%; max-height:250px; border-radius:6px; margin-top:10px;">`;
        }

        const cardDiv = document.createElement("div");
        cardDiv.className = `review-card ${isCorrect ? 'is-correct' : 'is-incorrect'}`;

        cardDiv.innerHTML = `
            <div class="review-card-header">
                <div class="review-question-text">${questionBody}</div>
                <span class="status-badge ${isCorrect ? 'correct' : 'incorrect'}">
                    ${isCorrect ? '✔ Correct' : '✖ Incorrect'}
                </span>
            </div>
            <div class="review-answer-line user-answer ${isCorrect ? 'right' : 'wrong'}">
                <strong>Your Answer:</strong> ${userAnsText}
            </div>
            ${!isCorrect ? `
                <div class="review-answer-line correct-answer">
                    <strong>Correct Answer:</strong> ${correctAnsText}
                </div>
            ` : ''}
            ${q.explanation ? `
                <div class="review-explanation" style="margin-top: 8px; font-size: 0.9em; color: #4a5568;">
                    <strong>Explanation:</strong> ${q.explanation}
                </div>
            ` : ''}
        `;

        reviewContainer.appendChild(cardDiv);
    });
}

function retakeExam() {
    startExamMode(currentExamMode);
}

// Default initialization (Modal will remain on screen until user submits mode)
window.onload = function() {
    // Mode modal overlay handles starting chosen mode on launch
};

// ==========================================
        // 1. QUESTION POOLS
        // ==========================================

        const numericalPool = [
            {
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "If 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 = 55, then <br>21 + 22 + 23 + 24 + 25 + 26 + 27 + 28 + 29 + 30 = ?",
                options: ["155", "230", "255", "355"],
                correct: 2,
				explanation: "<b>Step-by-Step Solution</b><ol type='1'><li>Identify the shift: Each term in the new sequence is 20 more than the original term (21=1+20, 22=2+20, ..., 30=10+20).</li><li>Count the terms: There are 10 terms in total.</li><li>Calculate the additional sum: Since each of the 10 terms is increased by 20, add 10×20=200 to the original sum.</li></ol><pre>Find the total: <b>55+200=255</b>.</pre><br><b>Simple Trick!</b><ol type='1'><li>Get the middle number from 21 to 30 which is 25.5 and multiply it by 10 (total count of numbers you are adding).</li></ol><pre>Answer is <b>255</b>.</pre>"
            },
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Evaluate: {20 - (30 - 10) + 15 × 6 - 5}",
                options: ["65", "75", "85", "105"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Find the product: 400 × 25",
                options: ["1,000", "10,000", "100,000", "40,000"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Find the quotient: 6,000 ÷ 125",
                options: ["40", "48", "56", "72"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Find the sum: 199 + 845 + 298 + 102",
                options: ["1344", "1444", "1544", "1442"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "If 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 = 55, then <br>201 + 202 + 203 + 204 + 205 + 206 + 207 + 208 + 209 + 210 = ?",
                options: ["1,055", "1,255", "2,055", "2,550"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "What is the remainder when 247,819 is divided by 8?",
                options: ["3", "5", "0", "1"],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Rounding 499,852 to the nearest thousand, the result is:",
                options: ["499,000", "499,900", "500,000", "500,800"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "If 15 + 25 + 35 + x + 45 = 170 and 15 + 25 + 40 + y + 30 = 130. <br>Find the value of x - y?",
                options: ["20", "30", "40", "50"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "245.052 is read as:",
                options: ["two hundred forty-five point zero fifty-two", "two hundred forty-five and fifty-two hundredths", "two hundred forty-five and fifty-two thousandths", "two hundred forty-five and fifty-two tenths"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "A number is divisible by 8 if its last three digits are divisible by 8. Which of the following numbers is divisible by 8?",
                options: ["5,114", "7,312", "12,418", "4,882"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Which of the following statements is true?",
                options: ["If a number is divisible by 3, then it is divisible by 9.", "If a number is divisible by 2, then it is divisible by 4.", "If a number is divisible by 6, then it is divisible by 3.", "If a number is divisible by 4, then it is divisible by 12."],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Simplify: <br><img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjv-D1K2_To382b5DAIYEL_ggpHFMe5V8qYRBSzvXgnK9HmTlQEEuRN8C0IaIB3m5AiZVfDX_DWNLefFJmL8mi9LxuymIxNOx0-XZ9J4bxii7Wf_buwvsX5gI95BDMD18e3GfYkIrbzPryR1yx12cWsSCunRf4365juNTHwwy4niyhcq13JAN47joVzSSGS/s1600/math_image2.JPG'/>",
                options: ["0", "35", "70", "105"],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Simplify: <br><img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjBF0NqA7kNnlQulGtKnQH5Jh4dgt95oSbWmHKAJndvHgBw2nhyphenhyphen3n0eAjIFuvB9YqWn54hmZriHqj69XldBvM2mvWpqPxQVWtuj4wwG0d9PM-YNumkuIfQQITO0Bx0qbwwm1oBTj1mAKNX86xJNQAxKjPY7rHioj6cY54bIBbsRJp-RkIhVY05Gf8zvUPDv/s1600/math_image1.JPG'/>",
                options: ["21", "25", "29", "34"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Reduce <br><img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhTM7S6uIs24YGidrJ-bMY42S7cWyYpd932ogw4HSv_p2lk8U7mucxdrfAtfkPTCU69Wa67XWDtKaygyNQeVEqt7LSEjJE6oNk8HPMEh96-lx__LvOIzZD8u8MYTPxxHcxBz_XEwrZ7vKt0iTb46kZDi2M4N7Bw5Nd_dBlHNY2cJ4Bkfcf9v4DMHy8JGq6-/s1600/math_image3.JPG' />",
                options: ["<img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjqsJNiUBMB-A-K0U8S9119kzVSEC6-Dpl7WOLdgAIdon3m2AO15bM2WZMtEGOF79_Fm_jl7mkdCaEEWRNunAjcRC5P1WvK92bVIF87ATY9-fPWr_L1x5ZyjeeCazx6ufGUPkCmGfbHz9fFj0u2XBfOWGlPlMATLFg3KMhIgAdglc_0yQxDtuqvS5rR4qwl/s1600/511.JPG'>", "<img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiXzQ4o5iipyVoql76mCQj8264RQce-HVN8XuYAZ84zDQTft0ffkpSBWMtoCl3YQpzSHUh-WVKMIzFcn4dzAzVF5kNS1WmR5FHaaslXiqHsMUQRroqSKdXF2zjnHQQLS2AdhVr1ozQJMw0XhvqjS4bahsm2VJEn_jzUswoofGpIs71itBdG0bQgNXxso4m1/s1600/513.JPG' />", "<img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgDERcSFT2ajDIt09zIN0I1FCqZ4ttE6pi4fVzvm8MxaxVEzLmyLzf05OZq8BjplmUChC3JEbGq6_yXaA49PSV6YHH2Dy6r2mNm3jHDTQSfYcIzgc43rnxSy2Z5aqLEtA4gl9c3l8ifEZ1lZcRP4XCGuLIO2XkqLtk3rs55S6NI4EyVFBJLTX4IDGjC_ynx/s1600/713.JPG' />", "<img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjVmjiS3LuNos-awjUPN_nJCthONQKN9H35PcJyUxn8TOjdQPzu2AfyzZfhhnftwtUhkpB7SDtgBMxS3SLu6WI9ek8WRtgsOVqWqhz9BoIZF7O-b6sn7cpEciTlaQh7eGJHCpP6_v0WTmf3kldmYGhMDGXMEnaRJ7kEDh-tEcU7YjAhvh19IQ_GNPsCeQmC/s1600/311.JPG' />"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Which of the following statements is true?",
                options: ["<img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhrY1ECC6chWOUSBD5i1lFTEoYTWObis2jC5TOzG366Fk0Z7M3Y-ZKJmyQefl9fdjgAwcUEtEfNosgHVwkt1_3kPrWFqydfTlpC89Dzq6LkQG2Rzwf8lypA39yLy1IiWqzb1lyUwTsNxL_CJVe24UuvdflfCJ6jOruF5n3V0VDsL9NnhicchlB-e9vdpPqD/s1600/a.JPG' />", "<img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh9W7-fv8joMZRt39ptsEN4hu1ifI91b-IX_z97wDGD0gETR4EjNGB6u2Zca90YcQyTN8gEqKwkkGRytU4JlKrL4s_3Y05uJan59D_9zDSCB1EJy7ewzK2P8KQHd_tosH9gMOymKr_cN34eQzbzzC61k7Co9moz9nJJhZ9n-uVRP3f4BOsreTQoHfZa6FER/s1600/b.JPG'/>", "<img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg_y3wuTijb93EAr5b3Z63nZYQylFnUbhl1u_1gXdGR3Z6uN5DEzHgE21iNJaCl0OLEJTPPSkGeUD8KrES3-ji5Ix6lnk4rulLBzHq5xClsyp17MArvN6zHxRxgUN_Lvv_iyZmpSAPyLqy65mkgTvukqqoXpHumlLSNnp_5DwvQQgI7zCpthkxu_bxGcvMs/s1600/c.JPG'/>", "<img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgb_YtwWvWEdDlLMYoxcxmW5hdKJoM6HRmSmH3Wi24pBxEPRRnTczoZukhA0fVpsniMMr3YrQ2eDt4rKTUMOI9juoES3upDlAV74F3KVl16nbJcIRlE4t1ynoPmksSmfdSC6gVJVPzFiSe9jygOgKxO1Nxk1w4bY6yBqzfI8i_lbjSS1CoiLyZiC6WuLiIM/s1600/d.JPG'/>"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Find the value of x:<br>64(48) 85(40) 97(x)",
                options: ["42", "54", "63", "72"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "What is 25% of 348?",
                options: ["72", "82", "87", "94"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "145 is 20% of what number?",
                options: ["29", "580", "725", "870"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "216 is what percent of 864?",
                options: ["25%", "30%", "40%", "400%"],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Evaluate: 245 × 0.1 + 245 × 0.01 + 245 × 0.001",
                options: ["27.195", "271.95", "2,719.5", "27,195"],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Find <br><img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgH5XpTNA7BD0FYLBSXME_zjszLqrAuLo99P2KE_9y8qh9_0-4e0RS_ZQ77Yh0GwvNpb4GxWHd7BiDJqXDqm11SSrVIIzUoI-q66schVN06xikJGxcANG9L5jM42IWujLEGlS5-l8sj0H17RsFXgy6xWRu8Dc0rPkL33pkpx_GappBSf8OVHyxLWmcG5F-0/s1600/zz.JPG' />",
                options: ["24", "54", "78", "82"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Evaluate:<br><img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjnybFO-_JG2ln5G7RqSVPs3JJNNc6etvwaNyK8QIVOLhTLwk7vXvgv_Dkg97NjFwFDIpQYxC3Le5iGRxFgkmEdBO-n7sm_k9Fw4cYmNKZdsc8RJ3ve6oeaZsfNRvcK-RvKWsUQJRX-vcRwgSyZ9NGST5G4OsWEBOjHyLyB7g3OF5j26DhtZhY_3AOuJYfY/s1600/a.JPG' />",
                options: ["<img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhksAnd4r0Ki_G3Vn-ocEX9khN22cMlDxCg_1rWmfbDJcU3Cw0kVctxamVP9BTPbz5XAgZJ5lunA_aPumQArENCIqeUZ4JnbCBndP0JlAo20BRDZ4Ll4ue4jefGDh86aGM3y2pZnTN-2yGmrzOUkhx-JzE-u0ykJtMeFs2v51YWt-zDs6XlKNUm48yr0jPj/s1600/a.JPG' />", "<img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhyOOIfex3jUPfJyZUxOARUsjDSSSsthYWnwSaCjnNGT74Gfq_c2DHcdIxN2GM0W3cpEv4c8ybbrTM8-BtfSDyMj9U4Kh9HfoKQxT0xcgzK8CvCXjf01WWY641JCsCcVOLID8k9Z8TcNDeX0VN1eYC2iwWUs_pPW3gHbFcoyrq42bLxplqsk_EMtr1cOylM/s1600/b.JPG' />", "<img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEi7hMlQAiuJrF9HUVWkZJTjpw9yti-KMmEApGmzcK6K9leyKilzgTcXK38vZvNSFeYJApthNO7YYVSYd9tgzQWwfdsf3NIQdSV4JbBK_kL7dYYQbl3LwAXcPa73xeNK4Atj95OO-oLufSAOKpqwf__U1KTdiYE_zFog9oF1gNAMFnORn7Q5XXffxG9MDQCq/s1600/c.JPG' />", "<img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgrBUYLQxbr8CtymtLlrczHp_L1hOB8rp887zRW4qo6megH6XsPc4bOdSkSiElNu3KuH7FtCH5BabbjCa9oySSJhmAvDwnenPj6Z23DAundqcxqmnuLdd1TRyZp18jlNDuqaRwWLAgJPgUREH_Mj93SflV8SHlPp9oNiN9R2khLgGQT0ZsQKf_tsq90bkhM/s1600/d.JPG' />"],
                correct: 3
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Find the value of x in the equation: <br>4x + 9 = 41",
                options: ["8", "-8", "±8", "5"],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Which of the following has the greatest value?",
                options: ["<img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiwMNuzBJVjoi2519e1eqWrLPNZ9CbXksEaMcJWw1CWxpBntt5LtqAm9u6Iq6970zxXDBLpW3CZpYyKereYecSEccgOLkYZshntZ7XgvkYSASCWZtVseCEmdsgV2c-duGAW7x9H0bzbGovem639gCVBGVFhmHqNVEMS8_vGsOHdcTDmlPVZmIOsYYUymygi/s1600/a.JPG' />", "<img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgWOhrUmzrRqzTZ9PVbDUNebNUmgcEEA_A59ij1g__kBjT5AyD8uU9q-Tpyx495hgFOaiw_0eqZr6cRsH7WC4YPqOrnbTqKmgRpiOScszUhGRi5KKpzvSwFx6Cp1yBVpYiysNjFycLYqvfspS1G-93n1HV0AUko6Z001l081RbI4fdl2IsMPdqE4eFPXbIn/s1600/b.JPG' />", "<img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgd_VwmFqUloRAu9Z8eyH-cJDmK9qfSYa4asQJjcuQNytanES6SZ6UnlaIiCmBesMQuAoje8VbBZT7QA6VvUrOXKppy95M8OtRUfzwKw6Mu_cLEpwhJ89nOEexRkW6w01Zcy2FWp1cETYJuoKd2HdQ7001p9rK0WXoSFFYWWkGUtz62vApXRRWjk3Mbphax/s1600/c.JPG' />", "<img src='https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgFupiWdmD8ybHLDM_SpySZpR8Traw_7xPTDTZwNn4uGXFWxePyQWYFrgILkHR7LFlpQcfSekimogcFp3UJOhbSFDRlOb37mBm3_8VzV_MXXe1bdca8oLWY8hlejKbjzkK0LK1Bbo102io1X3rdtBdm_of2vYmeXQA_6A4NAWTsFV3cB-AeCPSVoWGt8mYC/s1600/d.JPG' />"],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Which of the following cannot yield an even integer when divided by 2?",
                options: ["The sum of two even integers", "The difference between two odd integers", "The sum of four consecutive integers", "The product of two even integers"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "If 5x + 8 = 15, what is the value of 20x + 32?",
                options: ["30", "45", "60", "75"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "If a positive integer n is divisible by both 4 and 9, then n must also be divisible by:",
                options: ["18", "24", "36", "48"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "If positive integers a and b are not both even, which of the following is always true?",
                options: ["a + b is odd", "ab is odd", "(a + 1)(b + 1) is even", "a - b is even"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Find the average temperature change for the 10-day period. <br>Temperature change in degrees Celsius: <br>3.2, 4.5, 6.1, 5.4, 7.2, 4.8, 8.0, 5.5, 6.3, 5.0",
                options: ["5.2", "5.4", "5.6", "5.8"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Find the set of all integers x satisfying the conditions <br>4x - 5 ≤ 0 and 2x - 7 ≥ 0.",
                options: ["{1,2,3}", "{x ∣ x ≤ 1.25}", "{x ∣ x ≥ 3.5}", "∅"],
                correct: 3
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "State the property illustrated:<br>If 7(5) - 3 = 35 - 3 and 35 - 3 = 32, then 7(5) - 3 = 32.",
                options: ["Distributive property of multiplication over subtraction", "Commutative property of addition", "Transitive property of equality", "Symmetric property of equality"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "If 5 less than the product of a number and -4 is greater than 11, which of the following could be that number?",
                options: ["-5", "-3", "2", "4"],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "The difference between 7 times a number and 15 is 181. Find the number.",
                options: ["28", "32", "1372", "196"],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Three times the perimeter of a sports field is 24 less than 1,500 meters. What is the perimeter of the field?",
                options: ["492 m", "508 m", "738 m", "1,476 m"],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "The amount of last month's electricity bill, decreased by the product of 4 and Php25.00, equals Php2,150.75. Find the amount of last month's bill.",
                options: ["Php2,050.75", "Php2,125.75", "Php2,250.75", "Php2,275.75"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Fifteen less than six times the number of apples is 225. How many apples are there?",
                options: ["35", "40", "45", "50"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "A commercial building and land are sold for Php20M . The building costs 1.5 times as much as the land. How much does the land cost?",
                options: ["Php6M", "Php8M", "Php12M", "Php13.33M"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "The sale price of a laptop is Php18,000. The discount rate is 25%. Find its regular price.",
                options: ["Php13,500", "Php22,500", "Php24,000", "Php25,000"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "The lengths of the sides of a triangle can be represented by three consecutive integers. The perimeter of the triangle is 84 cm . Find the length of the longest side of the triangle.",
                options: ["27 cm", "28 cm", "29 cm", "30 cm"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "The length of a rectangle is 6 meters  more than twice its width. The perimeter is 96 meters.",
                options: ["196 m<sup>2</sup>", "384 m<sup>2</sup>", "476 m<sup>2</sup>", "512 m<sup>2</sup>"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Marco is 3 times as old as Leo. Five years ago, the sum of their ages was 30. How old is Leo now?",
                options: ["8", "10", "12", "30"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "For what value of x will x be the average of 4, 3x, 6, 8, and 12?",
                options: ["10", "15", "20", "30"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "How many integers between 150 and 250 are divisible by 3 or 5?",
                options: ["40", "42", "46", "52"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "A security guard must perform a check-in every 5 hours starting at 8:00 AM on Monday. On what day will the guard first complete a check-in at 9:00 AM?",
                options: ["Tuesday", "Wednesday", "Thursday", "Friday"],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Of the 250 students surveyed, 45 do not participate in any extracurricular activities. What percentage of the students do not participate in extracurricular activities?",
                options: ["15%", "18%", "20%", "25%"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "A fuel tank contains 120 liters of gasoline and is 30% full. How many liters of gasoline can this tank hold when it is completely full?",
                options: ["360L", "400L", "450L", "600L"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "How many crates each occupying an area of 1¾ square meters can be stored in a 735 square meter storage room?",
                options: ["380", "420", "450", "480"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "The starting salary of a graphic designer at XYZ Creative Agency is Php20,000 a month. Next year, the starting salary will be raised to Php25,000. What is the rate of increase in the starting salary?",
                options: ["15%", "20%", "25%", "30%"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "The cost of a square meter residential lot in a suburban area four years ago was Php8,000. There was a 350% increase in the price over the last four years. What is the price per square meter of that lot today?",
                options: ["Php28,000", "Php32,000", "Php36,000", "Php40,000"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Last month, a boutique manager decided to decrease the prices of all items by 20%. This month, she increased the new prices by 20%. What would be the price for a jacket that had cost Php1,200 before prices were decreased last month?",
                options: ["Php1,152.00", "Php1,200.00", "Php960.00", "Php1,440.00"],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "When the original price of an item is increased by a certain rate, the increased price is Php 4,800. When the original price is decreased by the same rate, the decreased price is Php 3,200. What is the original price of this item?",
                options: ["Php 3,600", "Php 4,000", "Php 4,200", "Php 4,400"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "How much must one have to invest in corporate bonds paying 8.5% in order to earn an income of Php17,000 per annum?",
                options: ["Php 144,500", "Php 170,000", "Php 200,000", "Php 250,000"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "How much must be cut from the edge of a wooden board 18 <sup>1</sup>/<sub>6</sub> cm wide, in order for it to fit into an opening 15 <sup>2</sup>/<sub>3</sub> cm wide?",
                options: ["2 <sup>1</sup>/<sub>3</sub> cm", "2 <sup>1</sup>/<sub>2</sub> cm", "2 <sup>5</sup>/<sub>6</sub> cm", "3 <sup>1</sup>/<sub>6</sub> cm"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "A sports car traveled for 3 <sup>1</sup>/<sub>2</sub> hours with an average speed of 120 <sup>1</sup>/<sub>4</sub> km per hour. Find the total distance it covered.",
                options: ["360 <sup>1</sup>/<sub>8</sub> km", "420 <sup>3</sup>/<sub>8</sub> km", "420 <sup>7</sup>/<sub>8</sub> km", "422 <sup>1</sup>/<sub>2</sub> km"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "If the weight of a 182-kg cargo trailer increases 2 <sup>1</sup>/<sub>4</sub> times when fully loaded, what will be its weight with a full load?",
                options: ["364 <sup>1</sup>/<sub>2</sub> kg", "409 <sup>1</sup>/<sub>2</sub> kg", "410 <sup>1</sup>/<sub>4</sub> kg", "455 <sup>1</sup>/<sub>4</sub> kg"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "How many liters will remain in a 2,000-liter storage tank if 6.5% of the liquid has evaporated due to excessive heat?",
                options: ["1,870", "1,935", "1,987", "1,993.5"],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Carlos recently sold some stocks for which he originally bought for Php450. If it has increased in value by 124%, how much did he receive for the stock?",
                options: ["Php 558.00", "Php 1,008.00", "Php 1,012.00", "Php 1,058.00"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Ms. Sarah Santos, a real estate broker, sold a commercial lot for Php240M. How much did she receive if her commission is 4.5% of the sale price of the property?",
                options: ["Php 9.6M", "Php 10.8M", "Php 11.2M", "Php 250.8M"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "If 480 out of 600 examinees passed in the recent Career Service exam for Professional level, what percent of the examinees passed?",
                options: ["70%", "75%", "80%", "85%"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Mr. Santos borrows Php500,000 from Metro Bank and is charged Php45,000 interest. What rate of interest did Metro Bank charge for the loan?",
                options: ["8%", "9%", "10%", "11%"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "A store sells shoes for Php1,250 a pair or 3 pairs for Php3,450. How much would one save by buying 3 pairs at a time instead of 3 pairs, one at a time?",
                options: ["Php 200", "Php 300", "Php 350", "Php 450"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "A camera can be rented for Php2,100 a week or Php420.00 a day. You need the camera only for 6 days. At which rate (daily or weekly), would it be cheaper to rent and by how much cheaper?",
                options: ["weekly: Php420", "daily: Php210", "daily: Php420", "weekly: Php210"],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "A 1.25 kg  box of Brand A fabric softener sells for Php 95.00. A 1.5 kg  box of Brand B fabric softener sells for Php 111.00. What is the difference in the price per kg?",
                options: ["Php 1.50", "Php 2.00", "Php 2.50", "Php 3.00"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "A 40-cm long copper wire costs Php156. At this rate, what is the price of the wire per meter?",
                options: ["Php 350", "Php 380", "Php 390", "Php 400"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "A homeowner can rent a pressure washer from a rental agency at Php 1,800 a day. A brand new pressure washer of the same model can be bought for Php 14,400. For how many days could the homeowner rent the washer before renting would cost more than buying?",
                options: ["6", "7", "8", "9"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "Paula uses eight 50-watt bulbs in her house. She uses these bulbs at an average of 6 hours each day. How many kWh do these bulbs use each day?",
                options: ["2.4", "4.8", "24", "2,400"],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "An electric oven uses 11,500 watts per hour and is run an average of 40 hours a year. How many kilowatt-hours is this?",
                options: ["46", "460", "4,600", "4.6"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "A board game purchased for Php600 was marked up 30% on the selling price. Later, as retail prices fell, this game was marked down 20% on the current sale price. Find its new sale price.",
                options: ["Php 576", "Php 600", "Php 624", "Php 780"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "ABC Corp. bought these office supplies last week: 1,600 pens @ Php 0.25; 1,200 packs of paper clips @ Php 0.75; 800 boxes of tape @ Php 1.50; 1,500 boxes of cards @ Php 0.60. A 5% sales tax is added. What was the company's total bill?",
                options: ["Php 170.00", "Php 3,400.00", "Php 3,570.00", "Php 3,650.00"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "The question: <u>How many meters of fencing are needed to enclose a square backyard?</u>, involves",
                options: ["area", "volume", "perimeter", "capacity"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "How many meters of fencing are needed to enclose a 75-meter by 35-meter rectangular garden?",
                options: ["110m", "210m", "220m", "2,625m<sup>2</sup>"],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "How many 1-cm square stickers are needed to cover a gift box 6cm long, 4cm wide, and 3cm high?",
                options: ["52", "72", "108", "144"],
                correct: 2,
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "One side of a triangle is 5cm longer than the shortest side, and the other side is 7cm longer than the shortest side. How long is the shortest side if the perimeter is 57cm",
                options: ["15cm", "20cm", "22cm", "25cm"],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Word Problems and Operations",
                sidebarId: "side-math-word",
                directions: "Directions: Analyze and solve each problem carefully. Choose the correct answer.",
                question: "The length of a rectangle is 3cm less than twice its width. What is its width in cm, if its perimeter is 54cm?",
                options: ["8", "10", "12", "17"],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "By what percent was the price of a backpack increased?<ol><li>The initial price of the backpack was Php500.</li><li>The new price of the backpack is Php600.</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "What was the selling price of a car if the real estate/sales agent received a commission of 10% of the selling price?<ol><li>The selling price minus the sales agent's commission was Php900,000.</li><li>The selling price was 200% of the original purchase price of Php500,000.</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 3
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "Anna and Ben were among those who sold magazine subscriptions to raise funds for the school. If Anna and Ben sold a total of 120 subscriptions, how many subscriptions did Anna sell?<ol><li>Ben sold 50% as many magazine subscriptions as Anna.</li><li>Ben sold 10% of all the magazine subscriptions sold in the entire school.</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "What is the ratio of x:y:z?<ol><li>z = 3, and xy = 72</li><li><sup>x</sup>/<sub>y</sub> = 3 and <sup>z</sup>/<sub>y</sub> = <sup>1</sup>/<sub>2</sub></li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "If a and b are integers, is a divisible by 13?<ol><li>The product ab is divisible by 13.</li><li>b is not divisible by 13.</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "On Friday morning, the bottling machine of Pure Water Co. ran continuously at a uniform rate to fill a production order. At what time did it completely fill the order that morning?<ol><li>The supervisor began the plan for production at 7:30 am.</li><li>The machine had filled 25% of the order at 8:15 am and 75% of the order by 8:45 am.</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "How many comic books does Lucas have?<ol><li>If Lucas had 24 fewer comic books, he would have only half as many as he actually has.</li><li>Lucas has four times as many superhero comics as manga comics.</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "What number is 30% of y?<ol><li>15 is 10% of y.</li><li><sup>1</sup>/<sub>5</sub> of y is 3,000</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 3
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "What was the total amount raised for the community relief fund from corporate and individual contributions?<ol><li>Of the total amount donated, 40% came from corporate contributions.</li><li>Of the total amount donated, Php12M came from individual contributions.</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "John's total score in the three bowling games was 510. What were his individual scores?<ol><li>John's highest score was 190.</li><li>The sum of John's two highest scores was 350.</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "Is the value of m closer to 30 than to 70?<ol><li>70 - m > m - 30</li><li>m > 40</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "In last Friday's Midnight Sale at Robinsons Place, a shop sold 60% of the jackets in its inventory. Each jacket was sold for Php500. What was the total revenue from the sale of these jackets on that day?<ol><li>When the shop opened last Friday, there were 300 jackets in its inventory.</li><li>All but 120 of the shop's inventory remained unsold at the end of the sale.</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 3
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "How many more cats than dogs are there in the animal shelter?<ol><li>There is a total of 30 cats and dogs in the shelter.</li><li>The number of cats in the shelter equals the square of the number of dogs.</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "In what year was Sarah born?<ol><li>Sarah's friend Leo is 2 years younger than her.</li><li>In 2010, Sarah turned 25 years old.</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "A bag contains 40 marbles, of which 24 are green and 16 are yellow. If 10 of the marbles are removed, how many of the marbles left in the bag are yellow?<ol><li>Of the marbles removed, the ratio of the number of green ones to the number of yellow ones is 3:2.</li><li>Of the first 5 marbles removed, 3 are green.</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "How long did it take Mr. Cruz to drive non-stop on a trip from his home to Tagaytay?<ol><li>If Mr. Cruz's average speed for the trip had been 2 times as fast, the trip would have taken 1.5 hours.</li><li>Mr. Cruz's average speed for the trip was 60 km per hour.</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 0
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "If Maya had a job interview on a certain day, was the interview on a Tuesday?<ol><li>Exactly 52 hours before the interview, it was Sunday.</li><li>The interview started between 1:00 PM and 6:00 PM.</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "What was the average number of kilometers per liter of gasoline a car consumed during a certain trip?<ol><li>The total cost of the gasoline used by the car for the 500-km trip was Php1,200.</li><li>The cost of the gasoline used by the car for the trip was Php20.00 per liter.</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 2
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "What is the ratio of x to y?<ol><li>x is 5 more than three times y.</li><li>The ratio of x to 3y is 2:5.</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 1
			},
			{
                subject: "Mathematics",
                subtopic: "Data Sufficiency",
                sidebarId: "side-math-data",
                directions: "Each of this data sufficiency problem consists of a question and two statements, numbered (1) and (2), in which certain data are given. You have to decide whether the data given in the statements are sufficient for answering the questions.",
                question: "At Apex Review Center, 500 students are enrolled for Program X or Program Y or both. If 120 of these students are not enrolled in Program X, how many of them are enrolled in both Program X and Program Y?<ol><li>Of the 500 students, 200 are not enrolled in Program Y.</li><li>A total of 300 of the students are enrolled in Program Y.</li></ol>",
                options: ["if statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.", "if statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.", "if BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.", "if each statement ALONE is sufficient.", "if statement (1) and (2) TOGETHER are not sufficient."],
                correct: 3
			}
        ];

        const verbalPool = [
			{
                subject: "English",
                subtopic: "Alphabetizing",
                sidebarId: "side-eng-alpha",
                directions: "Arrange each group of items in alphabetical order.",
                question: "<ol type='A'><li>Commission on the Filipino Language</li><li>Commission on Human Rights</li><li>Commission on Higher Education</li><li>Commission on Population</li></ol>",
                options: ["ABCD", "CBDA", "BCDA", "ACBD"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Alphabetizing",
                sidebarId: "side-eng-alpha",
                directions: "Arrange each group of items in alphabetical order.",
                question: "<ol type='A'><li>Department of Education</li><li>Department of Agriculture</li><li>Department of Finance</li><li>Department of Energy</li></ol>",
                options: ["BADC", "BCDA", "BDAC", "BCAD"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Alphabetizing",
                sidebarId: "side-eng-alpha",
                directions: "Arrange each group of items in alphabetical order.",
                question: "<ol type='A'><li>Santos, Maria A.</li><li>Santos, Maria B.</li><li>Santos, Maria</li><li>Santos, M. A.</li></ol>",
                options: ["ABCD", "DCAB", "DCBA", "CDAB"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Alphabetizing",
                sidebarId: "side-eng-alpha",
                directions: "Arrange each group of items in alphabetical order.",
                question: "<ol type='A'><li>Dela Cruz, Juan</li><li>De Castro, Pedro</li><li>Delos Reyes, Ana</li><li>De Leon, Clara</li></ol>",
                options: ["BDAC", "BADC", "ABCD", "BCAD"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Alphabetizing",
                sidebarId: "side-eng-alpha",
                directions: "Arrange each group of items in alphabetical order.",
                question: "<ol type='A'><li>Commission on Elections</li><li>Commission on Higher Education</li><li>Commission on Human Rights</li><li>Commission on Population</li></ol>",
                options: ["ABDC", "BACD", "BADC", "ABCD"],
                correct: 3
            },
			{
                subject: "English",
                subtopic: "Alphabetizing",
                sidebarId: "side-eng-alpha",
                directions: "Arrange each group of items in alphabetical order.",
                question: "<ol type='A'><li>Reyes, Maria L.</li><li>Reyes, Maria</li><li>Reyes, M. Anne</li><li>Reyes, Marissa</li></ol>",
                options: ["CBAD", "CBDA", "BCAD", "BCDA"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Alphabetizing",
                sidebarId: "side-eng-alpha",
                directions: "Arrange each group of items in alphabetical order.",
                question: "<ol type='A'><li>Ayala Corporation</li><li>Aboitiz Equity Ventures</li><li>Alliance Global Group</li><li>Acer Philippines</li></ol>",
                options: ["BDCA", "DBCA", "BCDA", "CBDA"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Alphabetizing",
                sidebarId: "side-eng-alpha",
                directions: "Arrange each group of items in alphabetical order.",
                question: "<ol type='A'><li>Boston Celtics</li><li>Brooklyn Nets</li><li>Chicago Bulls</li><li>Cleveland Cavaliers</li></ol>",
                options: ["ABCD", "BACD", "ACBD", "ABDC"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Alphabetizing",
                sidebarId: "side-eng-alpha",
                directions: "Arrange each group of items in alphabetical order.",
                question: "<ol type='A'><li>Globe Telecom</li><li>Google Philippines</li><li>Grab Philippines</li><li>GMA Network</li></ol>",
                options: ["DABC", "ADBC", "DBAC", "BACD"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Alphabetizing",
                sidebarId: "side-eng-alpha",
                directions: "Arrange each group of items in alphabetical order.",
                question: "<ol type='A'><li>Ateneo de Manila University</li><li>Adamson University</li><li>Arellano University</li><li>Asian Institute of Management</li></ol>",
                options: ["BCDA", "BACD", "CBDA", "BDCA"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Alphabetizing",
                sidebarId: "side-eng-alpha",
                directions: "Arrange each group of items in alphabetical order.",
                question: "<ol type='A'><li>Carlos Alcaraz</li><li>Carlos Yulo</li><li>Carlo Paalam</li><li>Calvin Oftana</li></ol>",
                options: ["DCAB", "CDAB", "DCBA", "ACDB"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Alphabetizing",
                sidebarId: "side-eng-alpha",
                directions: "Arrange each group of items in alphabetical order.",
                question: "<ol type='A'><li>World Health Organization</li><li>World Bank</li><li>World Trade Organization</li><li>World Wildlife Fund</li></ol>",
                options: ["BACD", "BCAD", "ABCD", "BADC"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Alphabetizing",
                sidebarId: "side-eng-alpha",
                directions: "Arrange each group of items in alphabetical order.",
                question: "<ol type='A'><li>Garcia, John</li><li>Garcia, James</li><li>Garcia, Joseph</li><li>Garcia, Jason</li></ol>",
                options: ["BDAC", "BADC", "BACD", "DBAC"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Alphabetizing",
                sidebarId: "side-eng-alpha",
                directions: "Arrange each group of items in alphabetical order.",
                question: "<ol type='A'><li>Golden State Warriors</li><li>Los Angeles Lakers</li><li>Miami Heat</li><li>New York Knicks</li></ol>",
                options: ["ABCD", "BACD", "ACBD", "ABDC"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Alphabetizing",
                sidebarId: "side-eng-alpha",
                directions: "Arrange each group of items in alphabetical order.",
                question: "<ol type='A'><li>Jollibee Foods Corporation</li><li>Johnson &amp; Johnson Philippines</li><li>JG Summit Holdings</li><li>J&amp;T Express Philippines</li></ol>",
                options: ["DCAB", "CDAB", "DACB", "CABD"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Alphabetizing",
                sidebarId: "side-eng-alpha",
                directions: "Arrange each group of items in alphabetical order.",
                question: "<ol type='A'><li>National Economic and Development Authority</li><li>National Housing Authority</li><li>National Irrigation Administration</li><li>National Labor Relations Commission</li></ol>",
                options: ["ABCD", "BACD", "ACBD", "ABDC"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Alphabetizing",
                sidebarId: "side-eng-alpha",
                directions: "Arrange each group of items in alphabetical order.",
                question: "<ol type='A'><li>Toyota Camry</li><li>Toyota Corolla</li><li>Toyota Avanza</li><li>Toyota Fortuner</li></ol>",
                options: ["CABD", "ACBD", "ABCD", "CBAD"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Alphabetizing",
                sidebarId: "side-eng-alpha",
                directions: "Arrange each group of items in alphabetical order.",
                question: "<ol type='A'><li>Philippine Army</li><li>Philippine Air Force</li><li>Philippine Navy</li><li>Philippine Coast Guard</li></ol>",
                options: ["BDAC", "BDCA", "BADC", "BACD"],
                correct: 0
            },
            {
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "Despite facing numerous setbacks, the team remained <b><i>resolute</i></b> in their mission to finish the project on time.",
                options: ["determined", "hesitant", "careless", "confused"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The diplomat's <b><i>perspicacious</i></b> analysis of the geopolitical crisis allowed the committee to anticipate the shift in regional alliances.",
                options: ["superficial", "discerning", "biased", "ambiguous"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The board of directors dismissed the CEO's proposal as an <b><i>inchoate</i></b> idea that lacked the necessary structure and feasibility for execution.",
                options: ["comprehensive", "redundant", "rudimentary", "sophisticated"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The scholar's argument relied on <b><i>recondite</i></b> concepts that only a few specialists in the department could fully comprehend.",
                options: ["accessible", "transparent", "profound", "superficial"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The critic dismissed the masterpiece with a series of <b><i>hostile</i></b> remarks.",
                options: ["conciliatory", "belligerent", "compliant", "indifferent"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The committee considered his <b><i>parsimonious</i></b> approach unreasonable because he refused to spend even a small amount for necessary repairs.",
                options: ["generous", "economical", "miserly", "extravagant"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The employee gave an <b><i>equivocal</i></b> response when asked whether he had approved the transaction; he neither confirmed nor denied it.",
                options: ["ambiguous", "sincere", "decisive", "convincing"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The politician's <b><i>ostentatious</i></b> display of wealth attracted attention, with expensive cars and jewelry prominently displayed during the event.",
                options: ["modest", "showy", "practical", "secretive"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The suspect's <b><i>clandestine</i></b> activities were eventually discovered after investigators learned that the meetings had been held secretly.",
                options: ["illegal", "organized", "concealed", "frequent"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "Because the witness was <b><i>reticent</i></b>, the investigators had difficulty obtaining information from her; she rarely spoke about the incident.",
                options: ["talkative", "reluctant to speak", "willing to cooperate", "eager to explain"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "His <b><i>impetuous</i></b> decision to resign was made without considering the consequences, and he regretted it the following day.",
                options: ["deliberate", "impulsive", "reasonable", "cautious"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The supervisor was <b><i>fastidious</i></b> about the office records, carefully examining every entry and rejecting documents with even minor errors.",
                options: ["careless", "demanding about details", "unfamiliar", "flexible"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The witness was <b><i>exonerated</i></b> after security footage proved that he was nowhere near the scene when the incident occurred.",
                options: ["questioned", "accused", "cleared of blame", "punished"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The medicine helped <b><i>alleviate</i></b> the patient's discomfort, making the pain considerably less severe.",
                options: ["intensify", "relieve", "conceal", "identify"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The athlete remained <b><i>tenacious</i></b> despite repeated failures, continuing to train until he finally achieved his goal.",
                options: ["persistent", "hesitant", "exhausted", "indifferent"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The manager's <b><i>reprehensible</i></b> behavior was strongly criticized because he knowingly blamed an innocent employee for his own mistake.",
                options: ["admirable", "forgivable", "disgraceful", "ordinary"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The employee's <b><i>obsequious</i></b> behavior toward the director was obvious; he constantly praised everything the director said in hopes of gaining favor.",
                options: ["rebellious", "excessively flattering", "professionally respectful", "completely indifferent"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The witness gave a <b><i>circumspect</i></b> answer, carefully choosing her words because she did not want to make an unsupported accusation.",
                options: ["careless", "cautious", "aggressive", "spontaneous"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The employee's <b><i>capricious</i></b> behavior made it difficult for his colleagues to predict what he would do next, since his decisions changed without an obvious reason.",
                options: ["unpredictable", "methodical", "responsible", "consistent"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The diplomat remained <b><i>reticent</i></b> during the interview, offering only brief responses to questions about the negotiations.",
                options: ["outspoken", "reserved", "enthusiastic", "argumentative"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The auditor discovered a <b><i>discrepancy</i></b> between the amount recorded in the ledger and the actual amount deposited.",
                options: ["similarity", "difference", "agreement", "confirmation"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The manager's <b><i>pragmatic</i></b> approach focused on finding a practical solution rather than discussing theoretical possibilities.",
                options: ["practical", "imaginative", "emotional", "theoretical"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The employee was <b><i>conscientious</i></b> about completing his duties, carefully reviewing every document before submitting it.",
                options: ["careless", "responsible", "impatient", "indifferent"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The scientist remained <b><i>skeptical</i></b> of the claim because the researchers could not provide sufficient evidence to support it.",
                options: ["doubtful", "convinced", "excited", "supportive"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The instructions were <b><i>ambiguous</i></b>, so several employees interpreted them in different ways.",
                options: ["precise", "unclear", "complete", "straightforward"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The witness gave a <b><i>credible</i></b> account of the incident, supported by photographs and other evidence.",
                options: ["believable", "questionable", "exaggerated", "fictional"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The committee decided to <b><i>defer</i></b> the decision until additional information could be obtained.",
                options: ["announce", "postpone", "reject", "accelerate"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The supervisor tried to <b><i>mitigate</i></b> the effects of the mistake by immediately correcting the affected records.",
                options: ["worsen", "conceal", "lessen", "repeat"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The employee was <b><i>candid</i></b> about the mistake and admitted that he had failed to follow the proper procedure.",
                options: ["honest", "secretive", "defensive", "uncertain"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The report provided a <b><i>comprehensive</i></b> analysis of the problem, covering its causes, effects, and possible solutions.",
                options: ["incomplete", "detailed", "brief", "superficial"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The manager was <b><i>adamant</i></b> that the company policy must be followed, despite repeated requests for an exception.",
                options: ["uncertain", "flexible", "firm", "confused"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The official's <b><i>discreet</i></b> handling of the sensitive information prevented unnecessary public attention.",
                options: ["careless", "tactful", "obvious", "public"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The new evidence <b><i>corroborated</i></b> the witness's statement and strengthened the investigators' case.",
                options: ["contradicted", "supported", "concealed", "questioned"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The professor's explanation was so <b><i>lucid</i></b> that even students unfamiliar with the subject were able to understand it.",
                options: ["confusing", "clear", "lengthy", "technical"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The employee's <b><i>inadvertent</i></b> disclosure of the information occurred because he mistakenly sent the document to the wrong recipient.",
                options: ["intentional", "accidental", "deliberate", "planned"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The director's decision to cancel the project was <b><i>controversial</i></b>, with employees expressing strongly different opinions about it.",
                options: ["widely accepted", "disputed", "insignificant", "predictable"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The instructions were <b><i>explicit</i></b>, clearly stating that all applications must be submitted before Friday.",
                options: ["vague", "implied", "definite", "questionable"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The employee showed remarkable <b><i>fortitude</i></b> while dealing with the difficult situation, continuing to work despite numerous setbacks.",
                options: ["courage", "confusion", "hesitation", "weakness"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Synonyms",
                sidebarId: "side-eng-syn",
                directions: "Choose the correct answer that corresponds to the word closest in meaning to the bold and italicized word in the sentence.",
                question: "The committee rejected the proposal because its benefits were <b><i>negligible</i></b> compared with the considerable cost of implementation.",
                options: ["substantial", "insignificant", "measurable", "valuable"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The lake remained <b><i>tranquil</i></b> throughout the early morning, with barely a ripple on its surface.",
                options: ["peaceful", "serene", "turbulent", "still"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The archaeologists discovered an <b><i>ancient</i></b> structure buried beneath several layers of soil.",
                options: ["historic", "primitive", "modern", "traditional"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The mountain trail became <b><i>treacherous</i></b> after heavy rain made the rocks extremely slippery.",
                options: ["dangerous", "hazardous", "safe", "difficult"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The author used <b><i>eloquent</i></b> language to describe the character's grief and loneliness.",
                options: ["expressive", "articulate", "inarticulate", "persuasive"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The museum displayed several <b><i>authentic</i></b> artifacts from the ancient civilization.",
                options: ["geniune", "original", "counterfeit", "legitimate"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The professor encouraged students to challenge <b><i>conventional</i></b> ideas and explore unconventional approaches to the problem.",
                options: ["traditional", "customary", "innovative", "established"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The desert climate is extremely <b><i>arid</i></b>, receiving very little rainfall throughout the year.",
                options: ["dry", "barren", "humid", "parched"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The instructions were <b><i>rigid</i></b>, leaving little room for students to modify the procedure.",
                options: ["strict", "inflexible", "adaptable", "firm"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The historian described the ruler as <b><i>benevolent</i></b>, noting that he frequently provided food and shelter to the poor.",
                options: ["charitable", "compassionate", "cruel", "generous"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The child's <b><i>inquisitive</i></b> nature led her to ask numerous questions about how the machine worked.",
                options: ["curious", "observant", "indifferent", "investigative"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The instructions were <b><i>tedious</i></b>, but the final activity was surprisingly enjoyable.",
                options: ["monotonous", "dull", "stimulating", "repetitive"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The scientist's findings were considered <b><i>tentative</i></b> because further experiments were still necessary.",
                options: ["uncertain", "provisional", "conclusive", "preliminary"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The old manuscript was remarkably <b><i>legible</i></b>, despite being hundreds of years old.",
                options: ["readable", "clear", "illegible", "distinct"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The speaker's argument was <b><i>coherent</i></b>, with each point logically connected to the next.",
                options: ["logical", "consistent", "disorganized", "reasonable"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The village experienced <b><i>abundant</i></b> rainfall during the monsoon season, filling its reservoirs quickly.",
                options: ["plentiful", "ample", "scarce", "sufficient"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The painting's colors were remarkably <b><i>vivid</i></b>, making the landscape appear almost three-dimensional.",
                options: ["bright", "striking", "dull", "vibrant"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The new evidence made the original explanation <b><i>plausible</i></b> and worthy of further investigation.",
                options: ["believable", "reasonable", "implausible", "credible"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The instructions require an <b><i>explicit</i></b> explanation of how the experiment was conducted.",
                options: ["clear", "definite", "implicit", "precise"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The festival was <b><i>chaotic</i></b>, with thousands of people moving through the narrow streets at the same time.",
                options: ["disorderly", "confused", "orderly", "turbulent"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The once-busy harbor became <b><i>desolate</i></b> after the shipping industry moved to another region.",
                options: ["deserted", "barren", "crowded", "abandoned"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The speaker remained <b><i>composed</i></b> despite the unexpected interruption during the presentation.",
                options: ["calm", "collected", "agitated", "controlled"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The instructions were deliberately <b><i>concise</i></b> so that travelers could quickly understand what to do during an emergency.",
                options: ["brief", "lengthy", "precise", "straightforward"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The author's argument was <b><i>compelling</i></b>, persuading many readers to reconsider their assumptions.",
                options: ["convincing", "persuasive", "unconvincing", "powerful"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The region's <b><i>prosperous</i></b> economy attracted thousands of people seeking employment and better opportunities.",
                options: ["thriving", "wealthy", "impoverished", "successful"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The child's <b><i>innocent</i></b> question unintentionally revealed something the adults had been trying to keep secret.",
                options: ["harmless", "sincere", "guilty", "naive"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The old theater was once <b><i>magnificent</i></b>, but years of neglect had left the building in poor condition.",
                options: ["splendid", "impressive", "ordinary", "grand"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The instructions were <b><i>mandatory</i></b> for all participants, with no exceptions permitted.",
                options: ["compulsary", "required", "voluntary", "obligatory"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The river became <b><i>shallow</i></b> as it approached the dry season, exposing rocks that were normally underwater.",
                options: ["narrow", "deep", "muddy", "calm"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The explorer was <b><i>cautious</i></b> when crossing the unstable bridge, carefully testing each step before moving forward.",
                options: ["careful", "reckless", "hesitant", "attentive"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The professor considered the student's explanation <b><i>plausible</i></b>, although more evidence was needed before accepting it as fact.",
                options: ["reasonable", "credible", "impossible", "believable"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The ancient civilization was known for its <b><i>elaborate</i></b> ceremonies, which involved intricate costumes, music, and rituals.",
                options: ["complicated", "detailed", "simple", "ornate"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The weather forecast predicted <b><i>sporadic</i></b> rainfall throughout the afternoon, with showers occurring at irregular intervals.",
                options: ["occasional", "intermittent", "continuous", "irregular"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The documentary presented a <b><i>biased</i></b> account of the historical event, giving attention to only one side of the controversy.",
                options: ["prejudiced", "one-sided", "impartial", "subjective"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The instructions were <b><i>obsolete</i></b> because the software had been completely redesigned several years earlier.",
                options: ["outdated", "irrelevant", "current", "antiquated"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The athlete's performance was <b><i>exceptional</i></b>, surpassing the previous record by several seconds.",
                options: ["remarkable", "extraordinary", "ordinary", "outstanding"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The town's water supply became <b><i>scarce</i></b> after months of drought.",
                options: ["limited", "insufficient", "plentiful", "inadequate"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Antonyms",
                sidebarId: "side-eng-ant",
                directions: "Choose the correct answer that corresponds to the word opposite in meaning to the bold and italicized word or phrase in the sentence.",
                question: "The author's writing style was <b><i>verbose</i></b>, using far more words than necessary to explain simple ideas.",
                options: ["wordy", "elaborate", "concise", "lengthy"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Moby-Dick : Herman Melville || The Old Man and the Sea : ________",
                options: ["Ernest Hemingway", "John Steinbeck", "Mark Twain", "F. Scott Fitzgerald"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Confucius : China || Mahatma Gandhi : ________",
                options: ["Nepal", "India", "Bhutan", "Sri Lanka"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Pride and Prejudice : Jane Austen || Great Expectations : ________",
                options: ["Charles Dickens", "George Eliot", "Thomas Hardy", "Oscar Wilde"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "The Odyssey : Homer || The Divine Comedy : ________",
                options: ["Virgil", "Dante", "Sophocles", "Euripides"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Romeo and Juliet : William Shakespeare || Les Misérables : ________",
                options: ["Alexandre Dumas", "Victor Hugo", "Gustave Flaubert", "Marcel Proust"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "The Great Gatsby : F. Scott Fitzgerald || To Kill a Mockingbird : ________",
                options: ["Harper Lee", "Toni Morrison", "Maya Angelou", "Emily Brontë"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Don Quixote : Miguel de Cervantes || The Little Prince : ________",
                options: ["Jules Verne", "Antoine de Saoint-Exupéry", "Albert Camus", "Adèle Foucher"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Noli Me Tangere : José Rizal || Florante at Laura : ________",
                options: ["Francisco Balagtas", "Nick Joaquin", "Lope K. Santos", "Amado V. Hernandez"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "The Hobbit : J.R.R. Tolkien || Harry Potter : ________",
                options: ["Suzanne Collins", "J.K. Rowling", "C.S. Lewis", "Philip Pullman"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "The Adventures of Tom Sawyer : Mark Twain || The Call of the Wild : _______",
                options: ["Jack London", "Ernest Hemingway", "Herman Melville", "H.G. Wells"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Albert Einstein : Relativity || Isaac Newton : ________",
                options: ["Evolution", "Gravity", "Psychoanalysis", "Electricity"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Marie Curie : Radioactivity || Charles Darwin : ________",
                options: ["Genetics", "Evolution", "Astronomy", "Anatomy"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Alexander Graham Bell : Telephone || Thomas Edison : ________",
                options: ["Airplane", "Lightbulb", "Telescope", "Microscope"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Neil Armstrong : Moon || Edmund Hillary : ________",
                options: ["K2", "Everest", "Kilimanjaro", "Elbrus"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Florence Nightingale : Nursing || Louis Pasteur : ________",
                options: ["Vaccination", "Painting", "Architecture", "Navigation"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Leonardo da Vinci : Mona Lisa || Michelangelo : ________",
                options: ["The Thinker", "David", "The Sick Child", "Guernica"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Vincent van Gogh : Starry Night || Edvard Munch : ________",
                options: ["The Scream", "Water Lilies", "American Gothic", "The Persistence of Memory"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Pablo Picasso : Guernica || Salvador Dalí : ________",
                options: ["The Kiss", "The Persistence of Memory", "Girl with a Pearl Earring", "Liberty Leading the People"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Beethoven : Symphony No. 9 || Mozart : ________",
                options: ["The Four Seasons", "Eine kleine Nachtmusik", "Swan Lake", "The Nutcracker"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "William Shakespeare : Hamlet || Sophocles : ________",
                options: ["Oedipus Rex", "Antigone", "Medea", "The Bacchae"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Japan : Tokyo || Australia : ________",
                options: ["Melbourne", "Canberra", "Sydney", "Brisbane"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "France : Paris || Italy : ________",
                options: ["Venice", "Milan", "Rome", "Naples"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Canada : Ottawa || Brazil : ________",
                options: ["São Paulo", "Brasília", "Rio de Janeiro", "Salvador"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Egypt : Cairo || Kenya : ________",
                options: ["Nairobi", "Mombasa", "Kampala", "Kigali"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Thailand : Bangkok || Vietnam : ________",
                options: ["Hanoi", "Manila", "Phnom Penh", "Vientiane"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Greece : Athens || Turkey : ________",
                options: ["Istanbul", "Ankara", "Izmir", "Bursa"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Mexico : Peso || United Kingdom : ________",
                options: ["Euro", "Dollar", "Pound", "Franc"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "South Korea : Won || India : ________",
                options: ["Rupee", "Taka", "Ringgit", "Baht"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Philippines : Peso || Indonesia : ________",
                options: ["Rupiah", "Dinar", "Riyal", "Dong"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Switzerland : Bern || Norway : ________",
                options: ["Stockholm", "Copenhagen", "Oslo", "Helsinki"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "United Nations : International Organization || WHO : ________",
                options: ["Military Alliance", "Health Organization", "Financial Institution", "Trade Association"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "NASA : Space || NOAA : ________",
                options: ["Weather", "Banking", "Transportation", "Agriculture"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "FBI : United States || Scotland Yard : ________",
                options: ["Canada", "Australia", "United Kingdom", "Ireland"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Bureau of Internal Revenue : Taxes || Department of Education : ________",
                options: ["Defense", "Education", "Transportation", "Tourism"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Philippine National Police : Law Enforcement || Bureau of Fire Protection : ________",
                options: ["Firefighting", "Banking", "Immigration", "Agriculture"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Great Wall of China : China || Machu Picchu : ________",
                options: ["Chile", "Peru", "Bolivia", "Ecuador"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Taj Mahal : India || Petra : ________",
                options: ["Jordan", "Egypt", "Iran", "Lebanon"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Colosseum : Rome || Acropolis : ________",
                options: ["Athens", "Sparta", "Delphi", "Corinth"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Mount Everest : Himalayas || Mount Kilimanjaro : ________",
                options: ["Andes", "Alps", "East Africa", "Rockies"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Single-Word Analogy",
                sidebarId: "side-eng-sanalogy",
                directions: "Choose the word that corresponds to the word that correctly completes each analogy.",
                question: "Nile : Africa || Amazon : ________",
                options: ["Europe", "South America", "Asia", "Australia"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "author : novel :: ________",
                options: ["painter : canvas", "farmer : harvest", "singer : melody", "sailor : ocean"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "puppy : dog :: ________",
                options: ["calf : horse", "kitten : cat", "foal : cow", "chick : eagle"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "doctor : hospital :: ________",
                options: ["teacher : classroom", "chef : recipe", "pilot : airplane", "farmer : tractor"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "book : library :: ________",
                options: ["painting : brush", "artifact : museum", "vehicle : highway", "flower : garden"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "fish : gills :: ________",
                options: ["bird : feathers", "snake : scales", "human : lungs", "turtle : shell"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "king : kingdom :: ________",
                options: ["president : republic", "soldier : army", "mayor : citizen", "judge : courtroom"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "pen : write :: ________",
                options: ["knife : eat", "brush : paint", "chair : sit", "clock : sleep"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "ice : cold :: ________",
                options: ["fire : hot", "snow : white", "rain : wet", "sand : dry"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "Eiffel Tower : France :: ________",
                options: ["Colosseum : Greece", "Taj Mahal : India", "Acropolis : Egypt", "Big Ben : Spain"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "Shakespeare : Hamlet :: ________",
                options: ["Dickens : Oliver Twist", "Austen : London", "Tolkien : England", "Homer : Greece"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "Amazon : river :: ________",
                options: ["Sahara : forest", "Everest : mountain", "Pacific : ocean", "Nile : desert"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "bee : hive :: ________",
                options: ["ant : colony", "wolf : den", "lion : jungle", "whale : sea"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "teacher : student :: ________",
                options: ["parent : child", "farmer : field", "author : publisher", "driver : vehicle"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "knife : cut :: ________",
                options: ["hammer : nail", "spoon : stir", "broom : sweep", "ladder : climb"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "rain : umbrella :: ________",
                options: ["sunlight : sunglasses", "wind : kite", "darkness : candle", "heat : refrigerator"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "lion : roar :: ________",
                options: ["horse : gallop", "snake : hiss", "rabbit : hop", "fish : swim"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "seed : plant :: ________",
                options: ["egg : bird", "fruit : tree", "soil : flower", "leaf : branch"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "captain : ship :: ________",
                options: ["conductor : orchestra", "pilot : aircraft", "engineer : bridge", "athlete : stadium"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "government : citizens :: ________",
                options: ["school : pupils", "market : products", "hospital : medicine", "theater : actors"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "firefighter : fire :: ________",
                options: ["detective : mystery", "gardener : flower", "mechanic : gasoline", "baker : oven"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "moon : night :: ________",
                options: ["sun : day", "star : galaxy", "cloud : sky", "rainbow : rain"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "feather : bird :: ________",
                options: ["fur : mammal", "shell : sand", "scale : river", "bark : forest"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "carpenter : wood :: ________",
                options: ["sculptor : marble", "farmer : wheat", "fisherman : boat", "tailor : clothing"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "jury : verdict :: ________",
                options: ["referee : whistle", "judge : sentence", "lawyer : courtroom", "witness : testimony"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "compass : direction :: ________",
                options: ["thermometer : temperature", "calendar : holiday", "telescope : planet", "ruler : classroom"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "rose : flower :: ________",
                options: ["oak : tree", "carrot : vegetable", "eagle : bird", "salmon : fish"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "author : manuscript :: ________",
                options: ["architect : blueprint", "musician : concert", "actor : audience", "athlete : trophy"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "law : justice :: ________",
                options: ["education : knowledge", "medicine : illness", "money : poverty", "exercise : fatigue"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "Bureau of Fire Protection : firefighter :: ________",
                options: ["school : teacher", "police station : officer", "hospital : patient", "library : reader"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "NASA : space :: ________",
                options: ["NOAA : weather", "embassy : diplomacy", "museum : history", "laboratory : experiment"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "Mona Lisa : Leonardo da Vinci :: ________",
                options: ["The Scream : Edvard Munch", "Guernica : Salvador Dalí", "David : Raphael", "Starry Night : Pablo Picasso"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "Mount Everest : Nepal :: ________",
                options: ["Kilimanjaro : Tanzania", "Fuji : China", "Andes : Brazil", "Alps : Portugal"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "Rome : Italy :: ________",
                options: ["Cairo : Morocco", "Madrid : Spain", "Berlin : Austria", "Lisbon : Greece"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "peso : Philippines :: ________",
                options: ["yen : Japan", "rupee : Thailand", "baht : India", "won : Indonesia"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "caterpillar : butterfly :: ________",
                options: ["tadpole : frog", "puppy : kitten", "acorn : flower", "seed : fruit"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "democracy : election :: ________",
                options: ["monarchy : crown", "classroom : examination", "republic : constitution", "court : evidence"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "doctor : diagnosis :: ________",
                options: ["detective : investigation", "farmer : irrigation", "teacher : graduation", "artist : exhibition"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "ocean : whale :: ________",
                options: ["desert : camel", "mountain : eagle", "forest : mushroom", "river : bridge"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "library : books :: ________",
                options: ["aquarium : fish", "stadium : tickets", "bakery : customers", "airport : luggage"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Double-Word Analogy",
                sidebarId: "side-eng-danalogy",
                directions: "Choose the word that corresponds to the pair of words that is related in the same way as the given pair of words.",
                question: "volcano : eruption :: ________",
                options: ["earthquake : tremor", "hurricane : umbrella", "glacier : mountain", "thunder : lightning"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "<u>Neither</u> <u>of the options</u> <u>seem</u> <u>viable</u> for the project. No error.",
                options: ["Neither", "of the options", "seem", "viable", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "The team <u>has</u> <u>completed</u> <u>their</u> assignment <u>ahead</u> of the deadline. No error.",
                options: ["has", "completed", "their", "ahead", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "Each of the participants <u>were</u> <u>given</u> a certificate <u>after</u> the <u>seminar</u>. No error.",
                options: ["were", "given", "after", "seminar", "No error."],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "She <u>is</u> one of those people who <u>always</u> <u>arrives</u> <u>late</u> to meetings. No error.",
                options: ["is", "always", "arrives", "late", "No error"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "Between <u>you and I</u>, <u>there</u> <u>is</u> no <u>secret</u>. No error.",
                options: ["you and I", "there", "is", "secret", "No error."],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "The committee <u>have<u> <u>reached</u> a unanimous <u>decision</u> <u>today</u>. No error.",
                options: ["have", "reached", "decision", "today", "No error."],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "Either the teacher <u>or</u> the <u>students</u> <u>is</u> <u>responsible</u> for the event. No error.",
                options: ["or", "students", "is", "responsible", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "He <u>runs</u> <u>more faster</u> <u>than</u> his brother <u>does</u>. No error.",
                options: ["runs", "more faster", "than", "does", "No error."],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "<u>Whom</u> <u>do you think</u> <u>will win</u> the election <u>this year</u>? No error.",
                options: ["Whom", "do you think", "will win", "this year", "No error."],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "Neither the manager <u>nor</u> his <u>assistants</u> <u>was</u> <u>aware</u> of the policy change. No error.",
                options: ["nor", "assistants", "was", "aware", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "She <u>layed</u> her coat <u>on</u> the chair <u>before</u> <u>leaving</u>. No error.",
                options: ["layed", "on", "before", "leaving", "Nor error."],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "The data <u>shows</u> <u>that</u> sales <u>have increased</u> <u>significantly</u>. No error.",
                options: ["shows", "that", "have increased", "significantly", "No error."],
                correct: 4
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "Every man and woman <u>are</u> <u>required</u> to sign <u>the</u> <u>document</u>. No error.",
                options: ["are", "required", "the", "document", "No error."],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "<u>Its</u> <u>a</u> well-known fact <u>that</u> water <u>boils</u> at 100°C. No error.",
                options: ["Its", "a", "that", "boils", "No error."],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "The reason <u>he failed</u> is <u>because</u> he <u>did not</u> <u>study</u>. No error.",
                options: ["he failed", "because", "did not", "study", "No error."],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "She <u>spoke</u> to <u>whoever</u> <u>was</u> standing <u>near</u> the entrance. No error.",
                options: ["spoke", "whoever", "was", "near", "No error."],
                correct: 4
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "The number of applicants <u>have</u> <u>increased</u> <u>dramatically</u> <u>this year</u>. No error.",
                options: ["have", "increased", "dramatically", "this year", "No error."],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "He <u>drove</u> <u>slow</u> down the <u>narrow</u> <u>winding</u> road. No error.",
                options: ["drove", "slow", "narrow", "winding", "No error."],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "<u>Irregardless</u> <u>of</u> the weather, we <u>will</u> proceed with the <u>match</u>. No error.",
                options: ["Irregardless", "of", "will", "match", "No error."],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "The collection of rare coins <u>were</u> <u>sold</u> at <u>an</u> <u>auction</u>. No error.",
                options: ["were", "sold", "an", "auction", "No error."],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "<u>One of</u> the students <u>forgot</u> <u>their</u> textbook on the <u>bench</u>. No error.",
                options: ["One of", "forgot", "their", "bench", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "The <u>list</u> of items <u>are</u> <u>displayed</u> on the main bulletin <u>board</u>. No error.",
                options: ["list", "are", "displayed", "board", "No error."],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "She is <u>taller</u> <u>than</u> <u>any</u> girl in her <u>class</u>. No error.",
                options: ["taller", "than", "any", "class", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "<u>Neither</u> of the answers <u>provided</u> by the speaker <u>were</u> <u>correct</u>. No error.",
                options: ["Neither", "provided", "were", "correct", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "The teacher, <u>as well as</u> the students, <u>were</u> <u>excited</u> <u>about</u> the field trip. No error.",
                options: ["as well as", "were", "excited", "about", "No error."],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "<u>Having finished</u> the <u>assignment</u>, <u>the tv</u> was <u>turned off</u> by Mark. No error.",
                options: ["Having finished", "assignment", "the tv", "turned off", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "The <u>food</u> <u>smelled</u> <u>deliciously</u> when we <u>entered</u> the kitchen. No error.",
                options: ["food", "smelled", "deliciously", "entered", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "He <u>could</u> of <u>passed</u> the exam <u>if he had</u> <u>studied</u> harder. No error.",
                options: ["could of", "passed", "if he had", "studied", "No error."],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "<u>Three miles</u> <u>is</u> a <u>long distance</u> to run in the summer <u>heat</u>. No error.",
                options: ["Three miles", "is", "long distance", "heat", "No error."],
                correct: 4
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "She <u>preferred</u> <u>reading</u> books <u>more than</u> <u>watching</u> movies. No error.",
                options: ["preferred", "reading", "more than", "watching", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "<u>Each of</u> the cars <u>in the showroom</u> <u>have</u> a full <u>warranty</u>. No error.",
                options: ["Each of", "in the showroom", "have", "warranty", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "He <u>spoke</u> <u>quiet</u> <u>so that</u> he <u>wouldn't wake</u> the sleeping baby. No error.",
                options: ["spoke", "quiet", "so that", "wouldn't wake", "No error."],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "The Mayor, <u>along with</u> his <u>security aides</u>, <u>are arriving</u> <u>shortly</u>. No error.",
                options: ["along with", "security aides", "are arriving", "shortly", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "This <u>chocolate</u> cake <u>tastes</u> much <u>more sweeter</u> than the <u>last one</u>. No error.",
                options: ["chocolate", "tastes", "more sweeter", "last one", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "The principal <u>presented</u> the <u>award</u> <u>to</u> Sarah and <u>I</u> during the assembly. No error.",
                options: ["presented", "award", "to", "I", "No error."],
                correct: 3
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "<u>Whose</u> <u>going to be</u> responsible <u>for organizing</u> the workshop <u>tomorrow</u>? No error.",
                options: ["Whose", "going to be", "for organizing", "tomorrow", "No error."],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "<u>Ten dollars</u> <u>are</u> <u>too much</u> to pay for a <u>single</u> cup of coffee. No error.",
                options: ["Ten dollars", "are", "too much", "single", "No error."],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "She <u>had swam</u> <u>across</u> the river before <u>help</u> <u>finally arrived</u>. No error.",
                options: ["had swam", "across", "help", "finally arrived", "No error."],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "My dog, <u>who</u> has dark <u>spots</u>, <u>loves to chase</u> <u>it's</u> own tail. No error.",
                options: ["who", "spots", "love to chase", "it's", "No error."],
                correct: 3
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "<u>Less</u> people <u>attended</u> the <u>conference</u> this year <u>than</u> last year. No error.",
                options: ["Less", "attended", "conference", "than", "No error."],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "<u>Neither</u> the manager nor the <u>employees</u> <u>was</u> willing to <u>compromise</u>. No error.",
                options: ["Neither", "employees", "was", "compromise", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "<u>Walking</u> <u>down</u> the street, <u>a sudden loud noise</u> <u>startled</u> the crowd. No error.",
                options: ["Walking", "down", "a sudden loud noise", "startled", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "He is the <u>most unique</u> artist <u>working</u> in the <u>studio</u> <u>today</u>. No error.",
                options: ["most unique", "working", "studio", "today", "No error."],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "The student <u>asked</u> <u>who</u> the letter was <u>addressed</u> <u>to</u>. No error.",
                options: ["asked", "who", "addressed", "to", "No error."],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "<u>Every</u> <u>member</u> of the choir <u>must practice</u> <u>their</u> routine daily. No error.",
                options: ["Every", "member", "must practice", "their", "No error."],
                correct: 3
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "<u>Neither</u> of the <u>two proposals</u> <u>seem</u> acceptable <u>to</u> the board members. No error.",
                options: ["Neither", "two proposals", "seem", "to", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "The <u>quality</u> of these <u>handcrafted</u> products <u>vary</u> <u>greatly</u>. No error.",
                options: ["quality", "handcrafted", "vary", "greatly", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "My <u>sister</u> and <u>myself</u> <u>completed</u> the entire puzzle <u>in</u> two hours. No error.",
                options: ["sister", "myself", "completed", "in", "No error."],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "He <u>has</u> <u>lain</u> his books <u>on</u> the desk every <u>afternoon</u> this week. No error.",
                options: ["has", "lain", "on", "every afternoon", "No error."],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "Either you <u>or</u> your <u>brother</u> <u>need to clear</u> the <u>dining</u> table. No error.",
                options: ["or", "brother", "need to clear", "dining", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "The manager, <u>together with</u> her <u>assistants</u>, <u>were present</u> <u>at the meeting</u>. No error.",
                options: ["together with", "assistants", "were present", "at the meeting", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "The new legislation <u>will affect</u> <u>everyone</u> <u>except</u> <u>you and I</u>. No error.",
                options: ["will affect", "everyone", "except", "you and I", "No error."],
                correct: 3
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "Neither the captain <u>nor</u> the <u>crew</u> <u>was prepared</u> for the <u>storm</u>. No error.",
                options: ["nor", "crew", "was prepared", "storm", "No error."],
                correct: 4
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "If I <u>was</u> you, I <u>would accept</u> the <u>job offer</u> <u>immediately</u>. No error.",
                options: ["was", "would accept", "job offer", "immediately", "No error."],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "The company <u>announced</u> <u>their</u> new <u>sales target</u> <u>yesterday morning</u>. No error.",
                options: ["announced", "their", "sales target", "yesterday morning", "No error."],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "Her performance in the play <u>was</u> <u>better than</u> <u>anyone</u> in her <u>class</u>. No error.",
                options: ["was", "better than", "anyone", "class", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "There <u>is</u> a pen, <u>two pencils</u>, and a <u>notebook</u> <u>on the desk</u>. No error.",
                options: ["is", "two pencils", "notebook", "on the desk", "No error."],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "The dog <u>wagged</u> <u>it's</u> tail <u>excitedly</u> when its owner <u>returned</u> home. No error.",
                options: ["wagged", "it's", "excitedly", "returned", "No error."],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "She had <u>scarcely</u> <u>started reading</u> <u>than</u> the <u>phone rang</u>. No error.",
                options: ["scarcely", "started reading", "than", "phone rang", "No error."],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Identifying Errors",
                sidebarId: "side-eng-err",
                directions: "Choose the word or phrases labeled A, B, C, or D which are NOT acceptable in formal written English. Choose E if there is no error.",
                question: "<u>All of</u> the soup <u>were</u> <u>spilled</u> <u>across</u> the kitchen counter. No error.",
                options: ["All of", "were", "spilled", "across", "No error."],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the first sentence?<ol type='A'><li>The process of recycling paper begins with the collection of used paper products from various sources.</li><li>Once sorted, these paper materials are mixed with water and chemicals to break them down into pulp.</li><li>After pulping, the mixture is cleaned and screened to remove any remaining contaminants or ink.</li><li>Next, the purified pulp is pressed and dried through large machinery to form giant rolls of new paper.</li><li>Finally, these rolls are cut into smaller sheets and distributed for everyday use.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the third sentence?<ol type='A'><li>The process of recycling paper begins with the collection of used paper products from various sources.</li><li>Once sorted, these paper materials are mixed with water and chemicals to break them down into pulp.</li><li>After pulping, the mixture is cleaned and screened to remove any remaining contaminants or ink.</li><li>Next, the purified pulp is pressed and dried through large machinery to form giant rolls of new paper.</li><li>Finally, these rolls are cut into smaller sheets and distributed for everyday use.</li></ol>",
                options: ["B", "A", "C", "D", "E"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "If sentence F is added, what would the new order of the sentences be?<ol type='A'><li>The process of recycling paper begins with the collection of used paper products from various sources.</li><li>Once sorted, these paper materials are mixed with water and chemicals to break them down into pulp.</li><li>After pulping, the mixture is cleaned and screened to remove any remaining contaminants or ink.</li><li>Next, the purified pulp is pressed and dried through large machinery to form giant rolls of new paper.</li><li>Finally, these rolls are cut into smaller sheets and distributed for everyday use.</li><li>Before collection even begins, households and offices are encouraged to sort their recyclable waste to ensure high material quality.</li></ol>",
                options: ["F-A-B-C-D-E", "A-F-B-C-D-E", "F-B-A-C-D-E", "A-B-C-D-E-F", "F-A-C-B-D-E"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the third sentence?<ol type='A'><li>Setting realistic daily goals is one of the most effective ways to manage your time.</li><li>Although planning every single hour can feel a bit restrictive at first, it ultimately reduces stress and increases productivity.</li><li>By breaking large tasks into smaller steps, we show ourselves that progress is completely achievable.</li><li>We also show that we are committed to finishing what we started.</li><li>Through careful planning, we prove to ourselves that our personal projects matter.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the fourth sentence?<ol type='A'><li>Setting realistic daily goals is one of the most effective ways to manage your time.</li><li>Although planning every single hour can feel a bit restrictive at first, it ultimately reduces stress and increases productivity.</li><li>By breaking large tasks into smaller steps, we show ourselves that progress is completely achievable.</li><li>We also show that we are committed to finishing what we started.</li><li>Through careful planning, we prove to ourselves that our personal projects matter.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 3
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the second sentence?<ol type='A'><li>Consequently, shifting to renewable energy sources is no longer just an environmental goal, but an economic necessity.</li><li>Fossil fuels have long powered global industrialization, yet their heavy carbon footprint accelerates severe climate instability.</li><li>Furthermore, transitioning away from these exhaustible resources drastically cuts down hazardous air pollutants in urban centers.</li><li>In addition, modern green technologies like solar and wind power generate millions of sustainable job opportunities worldwide.</li><li>The global economy relies heavily on energy, but traditional power generation methods pose significant long-term threats to the planet.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the last sentence?<ol type='A'><li>Consequently, shifting to renewable energy sources is no longer just an environmental goal, but an economic necessity.</li><li>Fossil fuels have long powered global industrialization, yet their heavy carbon footprint accelerates severe climate instability.</li><li>Furthermore, transitioning away from these exhaustible resources drastically cuts down hazardous air pollutants in urban centers.</li><li>In addition, modern green technologies like solar and wind power generate millions of sustainable job opportunities worldwide.</li><li>The global economy relies heavily on energy, but traditional power generation methods pose significant long-term threats to the planet.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the second sentence?<ol type='A'><li>Consequently, the heavy reliance on digital infrastructure creates unprecedented vulnerabilities that cybercriminals can exploit.</li><li>Modern societies are increasingly digitized, transforming how people work, communicate, and manage critical data globally.</li><li>Furthermore, unauthorized data breaches can paralyze entire supply chains and compromise millions of personal records overnight.</li><li>To counter these pervasive threats, robust multi-layered cybersecurity protocols and stringent regulatory frameworks are essential.</li><li>In addition, corporations face mounting financial and reputational losses when their proprietary networks are compromised.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the fourth sentence?<ol type='A'><li>Consequently, the heavy reliance on digital infrastructure creates unprecedented vulnerabilities that cybercriminals can exploit.</li><li>Modern societies are increasingly digitized, transforming how people work, communicate, and manage critical data globally.</li><li>Furthermore, unauthorized data breaches can paralyze entire supply chains and compromise millions of personal records overnight.</li><li>To counter these pervasive threats, robust multi-layered cybersecurity protocols and stringent regulatory frameworks are essential.</li><li>In addition, corporations face mounting financial and reputational losses when their proprietary networks are compromised.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 4
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What is the appropriate title for the above paragraph?",
                options: ["Digital Transformation", "Cybercriminal Networks", "Corporate Finance", "Digital Vulnerabilities and Cybersecurity", "Modern Workplaces"],
                correct: 3
            },
			{
			    subject: "English",
			    subtopic: "Paragraph Development",
			    sidebarId: "side-eng-para",
			    directions: "Each sentence below, when put in the correct order, would make a well-organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
			    question: "What should be the first sentence?<ol type='A'><li>Regular physical activity can also improve a person's mood and reduce stress.</li><li>Exercise is an important part of maintaining a healthy lifestyle.</li><li>For these reasons, people are encouraged to include exercise in their daily routines.</li><li>It helps strengthen the heart, muscles, and bones.</li><li>In addition, exercise can help people maintain a healthy weight and improve their sleep.</li></ol>",
			    options: ["A", "B", "C", "D", "E"],
			    correct: 1,
			    explanation: "Correct Sentence Order: B-D-A-E-C."
			},
			{
			    subject: "English",
			    subtopic: "Paragraph Development",
			    sidebarId: "side-eng-para",
			    directions: "Based on the organized paragraph, answer the question below.",
			    question: "What is the appropriate title for the above paragraph?<ol type='A'><li>Regular physical activity can also improve a person's mood and reduce stress.</li><li>Exercise is an important part of maintaining a healthy lifestyle.</li><li>For these reasons, people are encouraged to include exercise in their daily routines.</li><li>It helps strengthen the heart, muscles, and bones.</li><li>In addition, exercise can help people maintain a healthy weight and improve their sleep.</li></ol>",
			    options: [
			      "Different Types of Exercise",
			      "The Benefits of Regular Exercise",
			      "Problems Caused by Exercise",
			      "Exercise for Professional Athletes",
			      "The History of Physical Fitness"
			    ],
			    correct: 1,
			    explanation: "Correct Answer: <b>B. The Benefits of Regular Exercise</b><br><br><i>The entire paragraph focuses on the positive impacts of physical activity, such as strengthening the heart, muscles, and bones, maintaining weight, improving sleep, and boosting mood while reducing stress. None of the other options reflect the content of the text.</i>"
			},
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the second sentence?<ol type='A'><li>The next step is to place the tree carefully into the hole.</li><li>Planting a tree requires several simple but important steps.</li><li>Finally, the tree should be watered regularly while it develops its roots.</li><li>First, a suitable location with enough sunlight should be selected.</li><li>After that, the soil around the tree should be firmly packed.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 3,
				explanation: "Correct Sentence Order: <b>B-D-A-E-C</b>. <u>D. First, a suitable location with enough sunlight should be selected</u>. The word <b>first</b> means it is the <b>Step 1</b>. And <u>B. Planting a tree requires several simple but important steps.</u> acts as the <b>Introduction</b>. That's why letter D is the second sentence."
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What would be the new order of the sentences if sentence F is added?<ol type='A'><li>The next step is to place the tree carefully into the hole.</li><li>Planting a tree requires several simple but important steps.</li><li>Finally, the tree should be watered regularly while it develops its roots.</li><li>First, a suitable location with enough sunlight should be selected.</li><li>After that, the soil around the tree should be firmly packed.</li><li>This helps the roots settle into the soil and gives the young tree a stable foundation.</li></ol>",
                options: ["B-D-A-F-E-C", "B-D-A-E-F-C", "B-A-D-E-F-C", "B-D-F-A-E-C", "B-D-A-E-C-F"],
                correct: 1,
				explanation: "Correct Sentence Order: <b>B-D-A-E-F-C</b><ol type='A'><li>B. Planting a tree requires several simple but important steps. (Introduction)</li><li>D. First, a suitable location with enough sunlight should be selected. (Step 1)</li><li>A. The next step is to place the tree carefully into the hole. (Step 2)</li><li>E. After that, the soil around the tree should be firmly packed. (Step 3)</li><li>F. This helps the roots settle into the soil and gives the young tree a stable foundation. (Explains the purpose of step E)</li><li>C. Finally, the tree should be watered regularly while it develops its roots. (Final Step)</li></ol>"
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the first sentence?<ol type='A'><li>Students can watch recorded lessons and review materials whenever they need them.</li><li>Online learning has become increasingly common in recent years.</li><li>However, successful online learning requires students to manage their time responsibly.</li><li>It allows learners to access educational materials without always being physically present in a classroom.</li><li>As a result, online education can provide greater flexibility for many students.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the third sentence?<ol type='A'><li>Students can watch recorded lessons and review materials whenever they need them.</li><li>Online learning has become increasingly common in recent years.</li><li>However, successful online learning requires students to manage their time responsibly.</li><li>It allows learners to access educational materials without always being physically present in a classroom.</li><li>As a result, online education can provide greater flexibility for many students.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the first sentence?<ol type='A'><li>Finally, the sandwich can be cut in half and served.</li><li>Making a sandwich is a simple task that requires only a few ingredients.</li><li>Next, the chosen fillings are placed evenly on one slice of bread.</li><li>First, two slices of bread are prepared on a clean plate.</li><li>The second slice of bread is then placed on top of the fillings.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the third sentence?<ol type='A'><li>Finally, the sandwich can be cut in half and served.</li><li>Making a sandwich is a simple task that requires only a few ingredients.</li><li>Next, the chosen fillings are placed evenly on one slice of bread.</li><li>First, two slices of bread are prepared on a clean plate.</li><li>The second slice of bread is then placed on top of the fillings.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What is the appropriate title for the above paragraph?<ol type='A'><li>Finally, the sandwich can be cut in half and served.</li><li>Making a sandwich is a simple task that requires only a few ingredients.</li><li>Next, the chosen fillings are placed evenly on one slice of bread.</li><li>First, two slices of bread are prepared on a clean plate.</li><li>The second slice of bread is then placed on top of the fillings.</li></ol>",
                options: ["Different Kinds of Sandwiches", "The History of Bread", "How to Make a Simple Sandwich", "Healthy Foods for Breakfast", "Popular Sandwich Restaurants"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the second sentence?<ol type='A'><li>Without enough sleep, people may have difficulty concentrating during the day.</li><li>Getting enough sleep is essential for good health.</li><li>Therefore, maintaining a regular sleeping schedule is an important healthy habit.</li><li>During sleep, the body and brain have time to recover from daily activities.</li><li>Lack of sleep can also affect a person's mood and energy level.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 3
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the fourth sentence?<ol type='A'><li>Without enough sleep, people may have difficulty concentrating during the day.</li><li>Getting enough sleep is essential for good health.</li><li>Therefore, maintaining a regular sleeping schedule is an important healthy habit.</li><li>During sleep, the body and brain have time to recover from daily activities.</li><li>Lack of sleep can also affect a person's mood and energy level.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the first sentence?<ol type='A'><li>Visitors can then spend time examining the exhibits that interest them most.</li><li>Visiting a museum can be an enjoyable way to learn about history and culture.</li><li>Before entering, visitors may want to read the museum guide or map.</li><li>Many museums contain collections that tell stories about different periods and societies.</li><li>After exploring the exhibits, visitors may reflect on what they have learned.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the fourth sentence?<ol type='A'><li>Visitors can then spend time examining the exhibits that interest them most.</li><li>Visiting a museum can be an enjoyable way to learn about history and culture.</li><li>Before entering, visitors may want to read the museum guide or map.</li><li>Many museums contain collections that tell stories about different periods and societies.</li><li>After exploring the exhibits, visitors may reflect on what they have learned.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the last sentence?<ol type='A'><li>Visitors can then spend time examining the exhibits that interest them most.</li><li>Visiting a museum can be an enjoyable way to learn about history and culture.</li><li>Before entering, visitors may want to read the museum guide or map.</li><li>Many museums contain collections that tell stories about different periods and societies.</li><li>After exploring the exhibits, visitors may reflect on what they have learned.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 4
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What would be the new order of the sentences if sentence F is added?<ol type='A'><li>Visitors can then spend time examining the exhibits that interest them most.</li><li>Visiting a museum can be an enjoyable way to learn about history and culture.</li><li>Before entering, visitors may want to read the museum guide or map.</li><li>Many museums contain collections that tell stories about different periods and societies.</li><li>After exploring the exhibits, visitors may reflect on what they have learned.</li><li>A map can help visitors locate the different sections of the museum more easily.</li></ol>",
                options: ["B-D-C-F-A-E", "B-D-F-C-A-E", "B-C-D-A-F-E", "B-D-C-A-F-E", "B-C-F-D-A-E"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the second sentence?<ol type='A'><li>These materials can then be processed and used to make new products.</li><li>Recycling is one way people can reduce the amount of waste sent to landfills.</li><li>The collected materials are sorted according to their type.</li><li>People begin the process by placing recyclable materials in appropriate containers.</li><li>In this way, recycling helps conserve resources and reduce unnecessary waste.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What is the appropriate title for the above paragraph?<ol type='A'><li>These materials can then be processed and used to make new products.</li><li>Recycling is one way people can reduce the amount of waste sent to landfills.</li><li>The collected materials are sorted according to their type.</li><li>People begin the process by placing recyclable materials in appropriate containers.</li><li>In this way, recycling helps conserve resources and reduce unnecessary waste.</li></ol>",
                options: ["The History of Landfills", "How Recycling Works", "Different Types of Waste", "Problems Caused by Factories", "The Production of Plastic"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the first sentence?<ol type='A'><li>After studying, the student should test his or her knowledge by answering practice questions.</li><li>Preparing for an examination is easier when students have a clear study plan.</li><li>The student can then review the topics that need more attention.</li><li>First, the student should identify the subjects and topics that will be included in the examination.</li><li>Finally, the student should get enough rest before the examination day.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the third sentence?<ol type='A'><li>After studying, the student should test his or her knowledge by answering practice questions.</li><li>Preparing for an examination is easier when students have a clear study plan.</li><li>The student can then review the topics that need more attention.</li><li>First, the student should identify the subjects and topics that will be included in the examination.</li><li>Finally, the student should get enough rest before the examination day.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the last sentence?<ol type='A'><li>After studying, the student should test his or her knowledge by answering practice questions.</li><li>Preparing for an examination is easier when students have a clear study plan.</li><li>The student can then review the topics that need more attention.</li><li>First, the student should identify the subjects and topics that will be included in the examination.</li><li>Finally, the student should get enough rest before the examination day.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 4
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the first sentence?<ol type='A'><li>Over time, these small savings can become a significant amount of money.</li><li>Saving money requires discipline and careful planning.</li><li>People can begin by setting aside a small amount from each paycheck or allowance.</li><li>They should also avoid unnecessary purchases whenever possible.</li><li>Developing this habit can help people prepare for future expenses.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the fourth sentence?<ol type='A'><li>Over time, these small savings can become a significant amount of money.</li><li>Saving money requires discipline and careful planning.</li><li>People can begin by setting aside a small amount from each paycheck or allowance.</li><li>They should also avoid unnecessary purchases whenever possible.</li><li>Developing this habit can help people prepare for future expenses.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 3
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What would be the new order of the sentences if sentence F is added?<ol type='A'><li>Over time, these small savings can become a significant amount of money.</li><li>Saving money requires discipline and careful planning.</li><li>People can begin by setting aside a small amount from each paycheck or allowance.</li><li>They should also avoid unnecessary purchases whenever possible.</li><li>Developing this habit can help people prepare for future expenses.</li><li>Keeping track of daily spending can help people identify unnecessary expenses.</li></ol>",
                options: ["B-C-D-F-A-E", "B-C-F-D-A-E", "B-F-C-D-A-E", "B-C-D-A-F-E", "B-C-D-A-E-F"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What is the appropriate title for the above paragraph?<ol type='A'><li>When the water droplets become heavy enough, they fall to the ground as rain.</li><li>Clouds are formed when water vapor rises into the atmosphere and cools.</li><li>The tiny droplets join together and become larger.</li><li>This process is part of the water cycle.</li><li>The cooling causes the water vapor to condense into tiny droplets.</li></ol>",
                options: ["The Importance of Clean Water", "Different Types of Clouds", "How Rain Forms", "The Dangers of Heavy Rain", "Weather Forecasting"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the third sentence?<ol type='A'><li>When the water droplets become heavy enough, they fall to the ground as rain.</li><li>Clouds are formed when water vapor rises into the atmosphere and cools.</li><li>The tiny droplets join together and become larger.</li><li>This process is part of the water cycle.</li><li>The cooling causes the water vapor to condense into tiny droplets.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the first sentence?<ol type='A'><li>After eating, she prepares her bag and checks that she has everything she needs.</li><li>Maria begins each morning by getting out of bed at six o'clock.</li><li>She then eats a healthy breakfast before leaving the house.</li><li>She first washes her face and brushes her teeth.</li><li>Finally, she leaves home and travels to school.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the fourth sentence?<ol type='A'><li>After eating, she prepares her bag and checks that she has everything she needs.</li><li>Maria begins each morning by getting out of bed at six o'clock.</li><li>She then eats a healthy breakfast before leaving the house.</li><li>She first washes her face and brushes her teeth.</li><li>Finally, she leaves home and travels to school.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the second sentence?<ol type='A'><li>Buses and trains can carry many passengers at the same time.</li><li>Public transportation is an important part of many cities.</li><li>For this reason, public transportation can help reduce traffic congestion.</li><li>It provides people with a way to travel without using their own vehicles.</li><li>It can also reduce the number of cars on busy roads.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 3
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the third sentence?<ol type='A'><li>Buses and trains can carry many passengers at the same time.</li><li>Public transportation is an important part of many cities.</li><li>For this reason, public transportation can help reduce traffic congestion.</li><li>It provides people with a way to travel without using their own vehicles.</li><li>It can also reduce the number of cars on busy roads.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 4
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the last sentence?<ol type='A'><li>Buses and trains can carry many passengers at the same time.</li><li>Public transportation is an important part of many cities.</li><li>For this reason, public transportation can help reduce traffic congestion.</li><li>It provides people with a way to travel without using their own vehicles.</li><li>It can also reduce the number of cars on busy roads.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the first sentence?<ol type='A'><li>Regular visits to a veterinarian can also help detect health problems early.</li><li>Taking care of a pet is an important responsibility.</li><li>Pets need nutritious food, clean water, and a safe place to live.</li><li>Owners should also provide their pets with exercise and attention.</li><li>With proper care, pets can remain healthy and become valued members of a family.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What is the appropriate title for the above paragraph?<ol type='A'><li>Regular visits to a veterinarian can also help detect health problems early.</li><li>Taking care of a pet is an important responsibility.</li><li>Pets need nutritious food, clean water, and a safe place to live.</li><li>Owners should also provide their pets with exercise and attention.</li><li>With proper care, pets can remain healthy and become valued members of a family.</li></ol>",
                options: ["Different Kinds of Pets", "The Cost of Owning a Pet", "Caring for a Pet", "Animals in the Wild", "Choosing a Pet for Children"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the fourth sentence?<ol type='A'><li>Regular visits to a veterinarian can also help detect health problems early.</li><li>Taking care of a pet is an important responsibility.</li><li>Pets need nutritious food, clean water, and a safe place to live.</li><li>Owners should also provide their pets with exercise and attention.</li><li>With proper care, pets can remain healthy and become valued members of a family.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 3
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the first sentence?<ol type='A'><li>Regular practice helps learners remember new words and expressions.</li><li>Learning a new language takes time and consistent effort.</li><li>Listening to native speakers can also improve pronunciation and understanding.</li><li>Students may begin by learning common words and basic expressions.</li><li>Eventually, these skills can help learners communicate more confidently.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What would be the new order of the sentences if sentence F is added?<ol type='A'><li>Regular practice helps learners remember new words and expressions.</li><li>Learning a new language takes time and consistent effort.</li><li>Listening to native speakers can also improve pronunciation and understanding.</li><li>Students may begin by learning common words and basic expressions.</li><li>Eventually, these skills can help learners communicate more confidently.</li><li>Practicing conversations with other learners can give students opportunities to use the language in real situations.</li></ol>",
                options: ["B-D-A-F-C-E", "B-D-F-A-C-E", "B-A-D-C-F-E", "B-D-A-C-F-E", "B-D-A-C-E-F"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the second sentence?<ol type='A'><li>The soil should then be loosened and cleared of weeds.</li><li>Preparing a garden begins with choosing a suitable location.</li><li>Once the soil is ready, seeds or young plants can be placed in it.</li><li>The plants should be watered regularly after they are planted.</li><li>The location should receive enough sunlight for the chosen plants.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 4
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the last sentence?<ol type='A'><li>The soil should then be loosened and cleared of weeds.</li><li>Preparing a garden begins with choosing a suitable location.</li><li>Once the soil is ready, seeds or young plants can be placed in it.</li><li>The plants should be watered regularly after they are planted.</li><li>The location should receive enough sunlight for the chosen plants.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 3
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the first sentence?<ol type='A'><li>After finding the book, the student can borrow it using the library's checkout system.</li><li>Libraries provide access to books and other sources of information.</li><li>The student may first search the library catalog for a particular book.</li><li>Once the book is borrowed, it should be returned by the due date.</li><li>This allows students to use valuable resources for their studies.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the third sentence?<ol type='A'><li>After finding the book, the student can borrow it using the library's checkout system.</li><li>Libraries provide access to books and other sources of information.</li><li>The student may first search the library catalog for a particular book.</li><li>Once the book is borrowed, it should be returned by the due date.</li><li>This allows students to use valuable resources for their studies.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What is the appropriate title for the above paragraph?<ol type='A'><li>After finding the book, the student can borrow it using the library's checkout system.</li><li>Libraries provide access to books and other sources of information.</li><li>The student may first search the library catalog for a particular book.</li><li>Once the book is borrowed, it should be returned by the due date.</li><li>This allows students to use valuable resources for their studies.</li></ol>",
                options: ["How to Use a Library", "The History of Libraries", "Becoming a Librarian", "How Books Are Published", "Different Types of Books"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the first sentence?<ol type='A'><li>Clean water is necessary for drinking, cooking, and maintaining personal hygiene.</li><li>Communities must therefore take steps to protect their water sources.</li><li>Contaminated water can contain harmful substances and microorganisms.</li><li>Access to clean water is essential for human health.</li><li>These contaminants can cause serious illnesses if people consume the water.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 3
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the fourth sentence?<ol type='A'><li>Clean water is necessary for drinking, cooking, and maintaining personal hygiene.</li><li>Communities must therefore take steps to protect their water sources.</li><li>Contaminated water can contain harmful substances and microorganisms.</li><li>Access to clean water is essential for human health.</li><li>These contaminants can cause serious illnesses if people consume the water.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the second sentence?<ol type='A'><li>After deciding on a destination, travelers can research transportation and accommodations.</li><li>Planning a trip carefully can make traveling more organized and enjoyable.</li><li>They should also create a budget for food, transportation, activities, and other expenses.</li><li>Finally, travelers should prepare the necessary documents and belongings before leaving.</li><li>The first step is to decide where and when to travel.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the fourth sentence?<ol type='A'><li>After deciding on a destination, travelers can research transportation and accommodations.</li><li>Planning a trip carefully can make traveling more organized and enjoyable.</li><li>They should also create a budget for food, transportation, activities, and other expenses.</li><li>Finally, travelers should prepare the necessary documents and belongings before leaving.</li><li>The first step is to decide where and when to travel.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What would be the new order of the sentences if sentence F is added?<ol type='A'><li>After deciding on a destination, travelers can research transportation and accommodations.</li><li>Planning a trip carefully can make traveling more organized and enjoyable.</li><li>They should also create a budget for food, transportation, activities, and other expenses.</li><li>Finally, travelers should prepare the necessary documents and belongings before leaving.</li><li>The first step is to decide where and when to travel.</li><li>Making reservations early can help travelers secure their preferred transportation and accommodations.</li></ol>",
                options: ["B-E-A-F-C-D", "B-E-F-A-C-D", "B-A-E-F-C-D", "B-E-A-C-F-D", "B-E-A-C-D-F"],
                correct: 0
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the first sentence?<ol type='A'><li>The caterpillar eventually forms a chrysalis around itself.</li><li>A butterfly begins its life as a tiny egg.</li><li>Inside the chrysalis, the caterpillar undergoes major changes.</li><li>After the transformation is complete, an adult butterfly emerges.</li><li>The egg hatches into a caterpillar, which eats leaves and grows.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 1
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the third sentence?<ol type='A'><li>The caterpillar eventually forms a chrysalis around itself.</li><li>A butterfly begins its life as a tiny egg.</li><li>Inside the chrysalis, the caterpillar undergoes major changes.</li><li>After the transformation is complete, an adult butterfly emerges.</li><li>The egg hatches into a caterpillar, which eats leaves and grows.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What would be the new order of the sentences if sentence F is added?<ol type='A'><li>The caterpillar eventually forms a chrysalis around itself.</li><li>A butterfly begins its life as a tiny egg.</li><li>Inside the chrysalis, the caterpillar undergoes major changes.</li><li>After the transformation is complete, an adult butterfly emerges.</li><li>The egg hatches into a caterpillar, which eats leaves and grows.</li><li>The adult butterfly can then begin the life cycle again by laying eggs.</li></ol>",
                options: ["B-E-A-C-F-D", "B-A-E-C-D-F", "B-E-A-C-D-F", "B-E-C-A-D-F", "B-E-A-D-C-F"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What should be the fourth sentence?<ol type='A'><li>One simple way to reduce plastic waste is to use reusable bags and containers.</li><li>Plastic waste has become a major environmental concern in many communities.</li><li>People can also choose products that use less plastic packaging.</li><li>These small changes can reduce the amount of plastic that ends up in landfills and waterways.</li><li>If many people adopt these habits, the overall amount of plastic waste can be reduced.</li></ol>",
                options: ["A", "B", "C", "D", "E"],
                correct: 3
            },
			{
                subject: "English",
                subtopic: "Paragraph Development",
                sidebarId: "side-eng-para",
                directions: "Each sentence below, when put in the correct order would make a well organized paragraph. Decide what should be the correct order of the sentences, then answer the questions below.",
                question: "What is the appropriate title for the above paragraph?<ol type='A'><li>One simple way to reduce plastic waste is to use reusable bags and containers.</li><li>Plastic waste has become a major environmental concern in many communities.</li><li>People can also choose products that use less plastic packaging.</li><li>These small changes can reduce the amount of plastic that ends up in landfills and waterways.</li><li>If many people adopt these habits, the overall amount of plastic waste can be reduced.</li></ol>",
                options: ["The History of Plastic", "How Plastic Is Manufactured", "Ways to Reduce Plastic Waste", "Different Types of Plastic Products", "The Advantages of Plastic Packaging"],
                correct: 2
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The committee must ______ the applicants that all submitted documents will be treated confidentially.",
                options: ["advice", "advise", "advised", "advising"],
                correct: 1,
				explanation: "Correct answer is <b>advise</b>.<ul><li><b>Advise</b> is a verb meaning <u>to give information or recommendations</u>. <b>Advice</b> is the noun form. The sentence requires a verb after <b>must</b>.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The new policy may ______ the way government offices process applications.",
                options: ["effect", "affect", "effects", "affected"],
                correct: 1,
				explanation: "Correct answer is <b>affect</b>.<ul><li><b>Affect</b> is generally used as a verb meaning <u>to influence</u>. <b>Effect</b> is usually a noun meaning <u>result</u>, although it can also be a verb in a different construction.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The division chief emphasized that punctuality is a fundamental ______ of public service.",
                options: ["principal", "principally", "principled", "principle"],
                correct: 3,
				explanation: "Correct answer is <b>principle</b>.<ul><li><b>Principle</b> means a fundamental rule, belief, or standard. <b>Principal</b> means chief or most important, or it may refer to a person in charge.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The speaker's remarks were intended to ______ the importance of ethical conduct among public servants.",
                options: ["compliment", "compliments", "complement", "complementing"],
                correct: 2,
				explanation: "Correct answer is <b>complement</b>.<ul><li><b>Complement</b> means to complete, enhance, or emphasize something. <b>Compliment</b> means an expression of praise.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "Please use official ______ when preparing the memorandum for distribution.",
                options: ["stationery", "stationary", "stationarity", "stationer"],
                correct: 0,
				explanation: "Correct answer is <b>stationery</b>.<ul><li><b>Stationery</b> refers to writing materials such as paper and envelopes. <b>Stationary</b> means not moving.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The auditor remained ______ when discussing the irregularities discovered in the records.",
                options: ["discreet", "discrete", "discreetly", "discretion"],
                correct: 0,
				explanation: "Correct answer is <b>discreet</b>.<ul><li><b>Discreet</b> means careful, tactful, or prudent, especially concerning confidential matters. <b>Discrete</b> means separate or distinct.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The investigation seeks to ______ information from witnesses who may have observed the incident.",
                options: ["illicit", "elicit", "allude", "elude"],
                correct: 1,
				explanation: "Correct answer is <b>elicit</b>.<ul><li><b>Elicit<b> means to draw out information or a response. <b>Illicit</b> means unlawful or prohibited.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The agency established additional procedures to ______ that public funds are properly accounted for.",
                options: ["insure", "ensure", "assure", "insurance"],
                correct: 1,
				explanation: "Correct answer is <b>ensure</b>.<ul><li><b>Ensure</b> means to make certain. <b>Insure</b> generally refers to protection against financial loss, while assure is commonly used when giving confidence to a person.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The committee will ______ the proposal during its next meeting.",
                options: ["precede", "process", "precedent", "proceed"],
                correct: 3,
				explanation: "Correct answer is <b>proceed</b>.<ul><li><b>Proceed</b> means to continue or move forward. <b>Precede</b> means to come before something in time or order.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The newly appointed officer has a strong ______ in public administration.",
                options: ["background", "backdrop", "back ground", "back-ground"],
                correct: 0,
				explanation: "Correct answer is <b>background</b>.<ul><li><b>Background</b> is the standard one-word form referring to a person's education, experience, or history.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The employees were instructed to ______ the documents according to their respective categories.",
                options: ["classification", "classified", "classify", "classifying"],
                correct: 2,
				explanation: "Correct answer is <b>classify</b>.<ul><li>After the infinitive <b>to</b>, the base form of the verb is required: <i>to classify</i>.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "Neither the department head nor the employees ______ willing to disclose the contents of the report.",
                options: ["was", "were", "is", "has"],
                correct: 1,
				explanation: "Correct answer is <b>were</b>.<ul><li>With <i>neither...nor</i>, the verb generally agrees with the nearer subject. The nearer subject is plural, employees, so <b>were</b> is appropriate.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "Each of the applicants ______ required to present two valid identification cards.",
                options: ["are", "were", "have", "is"],
                correct: 3,
				explanation: "Correct answer is <b>is</b>.<ul><li><b>Each</b> is singular and requires a <i>singular verb</i>. Therefore, <b>each ... is required is correct</b>.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The records officer carefully examined the files to determine ______ documents were missing.",
                options: ["weather", "whether", "rather", "where"],
                correct: 1,
				explanation: "Correct answer is <b>whether</b>.<ul><li><b>Whether</b> introduces alternatives or uncertainty. <b>Weather</b> refers to atmospheric conditions.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The applicant was disqualified because he failed to ______ the required documents before the deadline.",
                options: ["submitted", "submitting", "submit", "submission"],
                correct: 2,
				explanation: "Correct answer is <b>submit</b>.<ul><li>After <b>failed to</b>, the base form of the verb is required: <i>failed to submit</i>.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The officer was asked to ______ the public that the agency would investigate the complaint.",
                options: ["ensure", "insure", "assurance", "assure"],
                correct: 3,
				explanation: "Correct answer is <b>assure</b>.<ul><li><b>Assure</b> is used when giving confidence to a person. The officer assures the public.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The government intends to ______ the old regulation with a more comprehensive policy.",
                options: ["adapt", "adopt", "adept", "adoption"],
                correct: 1,
				explanation: "Correct answer is <b>adopt</b>.<ul><li><b>Adopt</b> means to accept, implement, or take something as one's own. <b>Adapt</b> means to modify something for a particular purpose.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The office had to ______ the scheduled inspection because of the typhoon.",
                options: ["preposition", "propose", "position", "postpone"],
                correct: 3,
				explanation: "Correct answer is <b>postpone</b>.<ul><li><b>Postpone</b> means to delay an event or activity until a later time.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The agency will ______ the applicants of any changes in the examination schedule.",
                options: ["advice", "advise", "advising", "advisory"],
                correct: 1,
				explanation: "Correct answer is <b>advise</b>.<ul><li><b>Advise</b> is the verb meaning to inform or counsel. The construction <i>will advise</i> requires the base verb.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The new employee was praised for her ______ approach to handling confidential records.",
                options: ["conscientious", "conscious", "conscience", "conscientiously"],
                correct: 0,
				explanation: "Correct answer is <b>advise</b>.<ul><li><b>Conscientious</b> means careful, responsible, and diligent in one's work. <b>Conscious</b> means aware or awake.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The mayor's office requested that the report be submitted ______ the end of the month.",
                options: ["at", "by", "on", "into"],
                correct: 1,
				explanation: "Correct answer is <b>by</b>.<ul><li><b>By</b> indicates a deadline or latest time. The report must be submitted no later than the end of the month.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The supervisor reminded the staff that everyone is accountable for ______ actions.",
                options: ["his or her", "their", "there", "they're"],
                correct: 0,
				explanation: "Correct answer is <b>his or her</b>.<ul><li>In traditional formal usage, the singular pronoun <i>his or her</i> agrees with the singular indefinite pronoun <i>everyone</i>. <i>Their</i> is widely accepted in modern English as singular gender-neutral usage, but this item follows the formal agreement convention often tested in examinations.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The committee members arrived at a decision ______ after reviewing all the evidence.",
                options: ["altogether", "all together", "all-together", "altogetherly"],
                correct: 0,
				explanation: "Correct answer is <b>altogether</b>.<ul><li><b>Altogether</b> means completely or on the whole. <b>All together</b> means everyone or everything collectively.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The applicants were asked to remain ______ until their names were called.",
                options: ["quiet", "quite", "quit", "quietly"],
                correct: 0,
				explanation: "Correct answer is <b>quiet</b>.<ul><li><b>Quiet</b> means making little or no noise. <b>Quite</b> is an adverb meaning completely or fairly, while <b>quit</b> means to stop or leave.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The officer's explanation was ______ convincing to the members of the committee.",
                options: ["quiet", "quite", "quit", "quietly"],
                correct: 1,
				explanation: "Correct answer is <b>quite</b>.<ul><li><b>Quite</b> is an adverb modifying convincing. It means fairly or completely, depending on context.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The agency needs to ______ the value of the equipment before disposing of it.",
                options: ["appraise", "apprise", "praise", "appraised"],
                correct: 0,
				explanation: "Correct answer is <b>appraise</b>.<ul><li><b>Appraise</b> means to assess or determine the value of something. <b>Apprise</b> means to inform someone.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The director instructed her secretary to ______ him of any developments concerning the investigation.",
                options: ["appraise", "apprise", "appraisal", "praise"],
                correct: 1,
				explanation: "Correct answer is <b>apprise</b>.<ul><li><b>Apprise</b> means to inform or notify someone. The phrase apprise someone of something is standard usage.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The committee will ______ the results of the survey before recommending any changes.",
                options: ["analyze", "analysis", "analytical", "analyzing"],
                correct: 0,
				explanation: "Correct answer is <b>analyze</b>.<ul><li><b>After <i>will</i>, the base form of the verb is required: <i>will analyze</i>.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The employee was commended for her ______ handling of the sensitive complaint.",
                options: ["judicious", "judicial", "judiciary", "judgment"],
                correct: 0,
				explanation: "Correct answer is <b>judicious</b>.<ul><li><b>Judicious</b> means showing good judgment and careful consideration. <b>Judicial</b> relates to courts or the administration of justice.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The court issued an ______ order prohibiting the demolition of the structure.",
                options: ["eminent", "imminent", "imminent", "eminently"],
                correct: 1,
				explanation: "Correct answer is <b>imminent</b>.<ul><li><b>Imminent</b> means about to happen. <b>Eminent</b> means distinguished or famous.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The government official was considered an ______ authority on local governance.",
                options: ["imminent", "eminent", "immanent", "imminently"],
                correct: 1,
				explanation: "Correct answer is <b>eminent</b>.<ul><li><b>Eminent</b> means highly respected, distinguished, or prominent.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The employee's personal beliefs should not ______ her official duties.",
                options: ["affect", "effect", "effects", "affectedly"],
                correct: 0,
				explanation: "Correct answer is <b>affect</b>.<ul><li>Here, <b>affect</b> is a verb meaning <i>influence</i>. The sentence means personal beliefs should not influence official duties.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The new regulation is expected to have a significant ______ on the processing time of applications.",
                options: ["affect", "effect", "affects", "affecting"],
                correct: 1,
				explanation: "Correct answer is <b>effect</b>.<ul><li><b>Effect</b> is a noun meaning result or consequence. The phrase <i>have an effect</i> on is standard.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The manager asked the staff to ______ the problem before implementing a solution.",
                options: ["identify", "identity", "identification", "identifiable"],
                correct: 0,
				explanation: "Correct answer is <b>identify</b>.<ul><li><b>Identify</b> is the verb meaning to recognize or establish what something is. <b>Identity</b> is primarily a noun.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The applicant was asked to present proof of her ______ before the records could be released.",
                options: ["identity", "identify", "identification", "identifiable"],
                correct: 0,
				explanation: "Correct answer is <b>identity</b>.<ul><li><b>Identity</b> is the noun referring to who or what a person is.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The committee decided to ______ the proposal until additional information became available.",
                options: ["defer", "differ", "infer", "refer"],
                correct: 0,
				explanation: "Correct answer is <b>defer</b>.<ul><li><b>Defer</b> means to postpone or delay. <b>Differ</b> means to be unlike or disagree.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The two applicants ______ significantly in their interpretation of the regulation.",
                options: ["defer", "differ", "deferment", "difference"],
                correct: 1,
				explanation: "Correct answer is <b>differ</b>.<ul><li><b>Differ</b> means to be unlike or to disagree. The plural subject applicants takes differ.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The auditor found ______ errors in the revised report than in the original.",
                options: ["less", "lesser", "fewer", "fewest"],
                correct: 2,
				explanation: "Correct answer is <b>fewer</b>.<ul><li><b>Fewer</b> is traditionally used with countable plural nouns such as errors. <b>Less</b> is generally used with uncountable nouns such as money or time.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The office has ______ information about the incident than it initially reported.",
                options: ["fewer", "less", "few", "lesser"],
                correct: 1,
				explanation: "Correct answer is <b>less</b>.<ul><li><b>Information</b> is an uncountable noun, so less information is correct.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The director divided the responsibilities ______ the five members of the committee.",
                options: ["between", "among", "beside", "besides"],
                correct: 1,
				correct: 1,
				explanation: "Correct answer is <b>among</b>.<ul><li><b>Among</b> is traditionally used when referring to three or more persons or things. <b>Between</b> is commonly associated with two.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The memorandum was prepared ______ accordance with existing civil service regulations.",
                options: ["by", "at", "in", "on"],
                correct: 2,
				explanation: "Correct answer is <b>in</b>.<ul><li>The standard expression is <b>in accordance with</b>, meaning consistent with or following something.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The employee was absent ______ illness.",
                options: ["because", "because of", "due", "since of"],
                correct: 1,
				explanation: "Correct answer is <b>because of</b>.<ul><li><b>Because of</b> is a prepositional phrase and can be followed by a noun such as illness. <b>Because</b> is normally followed by a clause.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The decision was made ______ the recommendation of the technical committee.",
                options: ["pursuant to", "pursuant with", "pursuant at", "pursuant on"],
                correct: 0,
				explanation: "Correct answer is <b>pursuant to</b>.<ul><li><b>Pursuant to</b> is a formal expression meaning <i>in accordance with</i> or <i>following</i>. It is common in legal and government documents.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The employees were reminded to comply ______ the agency's security protocols.",
                options: ["to", "with", "on", "at"],
                correct: 1,
				explanation: "Correct answer is <b>with</b>.<ul><li>Explanation: The correct collocation is <b>comply with</b>, meaning to act according to a rule, request, or requirement.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The officer is responsible ______ ensuring that all records are properly filed.",
                options: ["of", "to", "for", "with"],
                correct: 2,
				explanation: "Correct answer is <b>for</b>.<ul><li>The standard construction is <b>responsible for + gerund/noun:</b> <i>responsible for ensuring</i>.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The applicant, together with her supporting documents, ______ submitted to the evaluation committee.",
                options: ["were", "have been", "was", "are"],
                correct: 2,
				explanation: "Correct answer is <b>was</b>.<ul><li>The main subject is <i>applicant</i>, which is singular. The phrase <i>together with her supporting documents</i> does not change the number of the subject.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The list of qualified candidates ______ posted on the agency's official bulletin board.",
                options: ["were", "have", "was", "are"],
                correct: 2,
				explanation: "Correct answer is <b>was</b>.<ul><li>The subject is <b>list</b>, not <b>candidates</b>. Since <i>ist</i> is singular, the correct verb is <b>was</b>.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The supervisor asked the employee ______ the report had already been submitted.",
                options: ["weather", "whether", "where", "rather"],
                correct: 1,
				explanation: "Correct answer is <b>whether</b>.<ul><li><b>Whether</b> introduces an indirect question involving uncertainty or alternatives: <i>asked whether the report had been submitted</i>.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The committee's decision was based ______ the documents submitted by the applicants.",
                options: ["in", "at", "on", "with"],
                correct: 2,
				explanation: "Correct answer is <b>on</b>.<ul><li>The standard expression is <b>based on</b>, meaning founded upon or determined from something.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Correct Usage",
                sidebarId: "side-eng-cor",
                directions: "Choose the letter that corresponds to the word or phrase that will correctly complete each sentence.",
                question: "The officer explained that the new procedure would ______ the processing of applications and reduce unnecessary delays.",
                options: ["facilitate", "facilitation", "facility", "facilitated"],
                correct: 0,
				explanation: "Correct answer is <b>facilitate</b>.<ul><li><b>Facilitate</b> is a verb meaning to make a process easier or more efficient. Because it follows <i>would</i>, the base form <i>facilitate</i> is required.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "What distinction does the author primarily make between silence and peace?<br><br><i>We often mistake the absence of noise for the presence of peace. A quiet room may conceal resentment, just as a crowded marketplace may contain people who are perfectly at ease. Peace is not simply the removal of conflict; it is the condition in which disagreements can exist without destroying the bonds between those who disagree. Thus, a society may appear peaceful while its people remain divided by fear, distrust, or injustice.<br><br>— Adapted philosophical passage</i>",
                options: ["Silence is always temporary, while peace is permanent.", "Peace requires the complete elimination of disagreement.", "Peace involves the ability to maintain relationships despite disagreement.", "Silence is harmful, while disagreement is beneficial."],
                correct: 2,
				explanation: "Correct answer is <b>Peace involves the ability to maintain relationships despite disagreement.</b>.<ul><li>The passage argues that peace is more than simply having no noise or conflict. People can disagree and still maintain healthy relationships. Therefore, it best captures the author's distinction.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which situation would BEST illustrate the author's idea of a society that only appears peaceful?<br><br><i>We often mistake the absence of noise for the presence of peace. A quiet room may conceal resentment, just as a crowded marketplace may contain people who are perfectly at ease. Peace is not simply the removal of conflict; it is the condition in which disagreements can exist without destroying the bonds between those who disagree. Thus, a society may appear peaceful while its people remain divided by fear, distrust, or injustice.<br><br>— Adapted philosophical passage</i>",
                options: ["Citizens openly debate a controversial law while respecting one another.", "Citizens avoid discussing injustice because they fear punishment.", "Citizens disagree about politics but freely express their opinions.", "Citizens resolve disagreements through discussion and compromise."],
                correct: 1,
				explanation: "Correct answer is <b>Citizens avoid discussing injustice because they fear punishment.</b>.<ul><li>The author says that a society may seem peaceful when people are actually divided by fear, distrust, or injustice. In the answer, people remain silent because they are afraid, creating an appearance of peace rather than genuine peace.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "What can be reasonably inferred about the author's view of disagreement?<br><br><i>We often mistake the absence of noise for the presence of peace. A quiet room may conceal resentment, just as a crowded marketplace may contain people who are perfectly at ease. Peace is not simply the removal of conflict; it is the condition in which disagreements can exist without destroying the bonds between those who disagree. Thus, a society may appear peaceful while its people remain divided by fear, distrust, or injustice.<br><br>— Adapted philosophical passage</i>",
                options: ["Disagreement is evidence that peace has completely failed.", "Disagreement should be eliminated whenever possible.", "Disagreement can coexist with peace under certain conditions.", "Disagreement is more valuable than agreement."],
                correct: 2,
				explanation: "Correct answer is <b>Disagreement can coexist with peace under certain conditions.</b>.<ul><li>The author explicitly states that peace is a condition where “disagreements can exist without destroying the bonds” between people. Thus, disagreement itself does not necessarily mean the absence of peace. The answer is the best inference.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which statement BEST expresses the central idea of the passage?<br><br><i>We often mistake the absence of noise for the presence of peace. A quiet room may conceal resentment, just as a crowded marketplace may contain people who are perfectly at ease. Peace is not simply the removal of conflict; it is the condition in which disagreements can exist without destroying the bonds between those who disagree. Thus, a society may appear peaceful while its people remain divided by fear, distrust, or injustice.<br><br>— Adapted philosophical passage</i>",
                options: ["Silence is usually more dangerous than open conflict.", "A peaceful society must prevent people from disagreeing.", "Genuine peace depends on how people handle conflict, not merely on the absence of conflict.", "Societies with many disagreements are generally unstable."],
                correct: 2,
				explanation: "Correct answer is <b>Genuine peace depends on how people handle conflict, not merely on the absence of conflict.</b>.<ul><li>The entire passage contrasts superficial peace with genuine peace. The author's main point is that the way disagreements are managed is more important than simply eliminating visible conflict.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Why does the author mention a crowded marketplace?<br><br><i>We often mistake the absence of noise for the presence of peace. A quiet room may conceal resentment, just as a crowded marketplace may contain people who are perfectly at ease. Peace is not simply the removal of conflict; it is the condition in which disagreements can exist without destroying the bonds between those who disagree. Thus, a society may appear peaceful while its people remain divided by fear, distrust, or injustice.<br><br>— Adapted philosophical passage</i>",
                options: ["To demonstrate that crowded places are usually more peaceful than quiet places.", "To show that public places naturally produce disagreement.", "To demonstrate that physical noise does not necessarily indicate conflict.", "To prove that people behave differently in public than in private."],
                correct: 2,
				explanation: "Correct answer is <b>To demonstrate that physical noise does not necessarily indicate conflict.</b>.<ul><li>The marketplace is used as a contrast to the quiet room. Even though a marketplace is noisy and crowded, the people there may be perfectly at ease. This supports the author's argument that peace cannot be measured simply by the amount of noise or activity.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "What does the “two roads” most likely symbolize in the poem?<br><br><b>The Road Not Taken</b><br><br><i>Two roads diverged in a yellow wood,<br>And sorry I could not travel both<br>And be one traveler, long I stood<br>And looked down one as far as I could<br>To where it bent in the undergrowth;<br><br>Then took the other, as just as fair,<br>And having perhaps the better claim,<br>Because it was grassy and wanted wear;<br>Though as for that the passing there<br>Had worn them really about the same.<br><br>— excerpt from The Road Not Taken by Robert Frost</i>",
                options: ["Two physical destinations the speaker wants to visit.", "Different choices or directions available in life.", "The difference between nature and civilization.", "The conflict between two people."],
                correct: 1,
				explanation: "Correct answer is <b>Different choices or directions available in life.</b>.<ul><li>The roads are presented as alternatives, and the speaker must choose only one. This represents choices or paths in life, making the answer the best interpretation.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Why does the speaker say, “sorry I could not travel both”?<br><br><b>The Road Not Taken</b><br><br><i>Two roads diverged in a yellow wood,<br>And sorry I could not travel both<br>And be one traveler, long I stood<br>And looked down one as far as I could<br>To where it bent in the undergrowth;<br><br>Then took the other, as just as fair,<br>And having perhaps the better claim,<br>Because it was grassy and wanted wear;<br>Though as for that the passing there<br>Had worn them really about the same.<br><br>— excerpt from The Road Not Taken by Robert Frost</i>",
                options: ["He regrets entering the forest.", "He believes both roads are dangerous.", "He is physically unable to walk on both roads.", "He recognizes that choosing one path means giving up the opportunity to experience the other."],
                correct: 3,
				explanation: "Correct answer is <b>He recognizes that choosing one path means giving up the opportunity to experience the other.</b>.<ul><li>The speaker is a traveler who must make a choice. Since he cannot experience both possibilities, he feels some regret about the opportunity he must leave behind.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "What is the significance of the statement “Had worn them really about the same”?<br><br><b>The Road Not Taken</b><br><br><i>Two roads diverged in a yellow wood,<br>And sorry I could not travel both<br>And be one traveler, long I stood<br>And looked down one as far as I could<br>To where it bent in the undergrowth;<br><br>Then took the other, as just as fair,<br>And having perhaps the better claim,<br>Because it was grassy and wanted wear;<br>Though as for that the passing there<br>Had worn them really about the same.<br><br>— excerpt from The Road Not Taken by Robert Frost</i>",
                options: ["It proves that one road was objectively more dangerous.", "It reveals that the difference between the two choices may not have been as significant as the speaker initially believed.", "It shows that the speaker made the wrong choice.", "It suggests that neither road could be traveled."],
                correct: 1,
				explanation: "Correct answer is <b>It reveals that the difference between the two choices may not have been as significant as the speaker initially believed.</b>.<ul><li>Earlier, the speaker describes one road as having a “better claim” because it appeared less traveled. However, he then admits that both roads had actually been worn “really about the same.” This suggests that the choices were not clearly different.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which statement BEST describes the speaker's attitude toward making his decision?<br><br><b>The Road Not Taken</b><br><br><i>Two roads diverged in a yellow wood,<br>And sorry I could not travel both<br>And be one traveler, long I stood<br>And looked down one as far as I could<br>To where it bent in the undergrowth;<br><br>Then took the other, as just as fair,<br>And having perhaps the better claim,<br>Because it was grassy and wanted wear;<br>Though as for that the passing there<br>Had worn them really about the same.<br><br>— excerpt from The Road Not Taken by Robert Frost</i>",
                options: ["He is completely confident and experiences no uncertainty.", "He is angry because someone forced him to choose.", "He is thoughtful and uncertain because he understands that choosing one path means leaving another behind.", "He is indifferent because both choices have no consequences."],
                correct: 2,
				explanation: "Correct answer is <b>He is thoughtful and uncertain because he understands that choosing one path means leaving another behind.</b>.<ul><li>The speaker “long [stood]” and carefully examined the roads before choosing. This demonstrates hesitation and careful consideration. He understands that his decision involves giving up another possibility.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "What can be inferred from the speaker's decision to “look down one as far as I could”?<br><br><b>The Road Not Taken</b><br><br><i>Two roads diverged in a yellow wood,<br>And sorry I could not travel both<br>And be one traveler, long I stood<br>And looked down one as far as I could<br>To where it bent in the undergrowth;<br><br>Then took the other, as just as fair,<br>And having perhaps the better claim,<br>Because it was grassy and wanted wear;<br>Though as for that the passing there<br>Had worn them really about the same.<br><br>— excerpt from The Road Not Taken by Robert Frost</i>",
                options: ["He already knows exactly what will happen after making his choice.", "He attempts to understand the possible consequences of his choice before committing to it.", "He wants to find another traveler to ask for advice.", "He is trying to avoid making a decision altogether."],
                correct: 1,
				explanation: "Correct answer is <b>He attempts to understand the possible consequences of his choice before committing to it.</b>.<ul><li>The speaker looks as far down the road as possible before choosing. This suggests that he is trying to evaluate what lies ahead and consider the consequences before making his decision.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which idea is MOST strongly developed by the passage?<br><br><b>The Road Not Taken</b><br><br><i>Two roads diverged in a yellow wood,<br>And sorry I could not travel both<br>And be one traveler, long I stood<br>And looked down one as far as I could<br>To where it bent in the undergrowth;<br><br>Then took the other, as just as fair,<br>And having perhaps the better claim,<br>Because it was grassy and wanted wear;<br>Though as for that the passing there<br>Had worn them really about the same.<br><br>— excerpt from The Road Not Taken by Robert Frost</i>",
                options: ["Nature is more powerful than human beings.", "People should always choose the road that fewer people have traveled.", "Difficult journeys are more valuable than easy ones.", "Making choices often requires accepting uncertainty and giving up alternative possibilities."],
                correct: 3,
				explanation: "Correct answer is <b>Making choices often requires accepting uncertainty and giving up alternative possibilities.</b>.<ul><li>The speaker has two possible paths but can travel only one. He carefully considers them, realizes they are quite similar, and eventually chooses one. The passage therefore emphasizes the difficulty and uncertainty involved in making choices.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "What figure of speech is most clearly used in the line, “A little star the darkness made”?<br><br><b>The Last Lantern</b><br><i>by Anonymous<br><br>At dusk, the village closed its doors,<br>While shadows climbed the silent floors.<br>One lantern burned beside the gate,<br>Though no one knew whom it would wait.<br><br>The road beyond was dark and long,<br>The wind had swallowed every song.<br>Yet through the night, the lantern stayed,<br>A little star the darkness made.<br><br>At dawn, a traveler reached the town,<br>His weary steps were dragging down.<br>He saw the light and understood:<br>Some hope remains where others would.</i>",
                options: ["simile", "hyperbole", "metaphor", "irony"],
                correct: 2,
				explanation: "Correct answer is <b>metaphor</b>.<ul><li>The lantern is directly compared to a “little star” without using <i>like</i> or <i>as</i>. This makes the figure of speech a metaphor. The comparison emphasizes how the small light provides guidance and hope in the darkness.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "What is the most reasonable inference about the person who left the lantern burning?<br><br><b>The Last Lantern</b><br><i>by Anonymous<br><br>At dusk, the village closed its doors,<br>While shadows climbed the silent floors.<br>One lantern burned beside the gate,<br>Though no one knew whom it would wait.<br><br>The road beyond was dark and long,<br>The wind had swallowed every song.<br>Yet through the night, the lantern stayed,<br>A little star the darkness made.<br><br>At dawn, a traveler reached the town,<br>His weary steps were dragging down.<br>He saw the light and understood:<br>Some hope remains where others would.</i>",
                options: ["The person expected the village to be attacked during the night.", "The person deliberately preserved a sign of hope or guidance despite uncertainty.", "The person forgot to extinguish the lantern before leaving.", "The person wanted to make the village appear occupied."],
                correct: 1,
				explanation: "Correct answer is <b>The person deliberately preserved a sign of hope or guidance despite uncertainty.</b>.<ul><li>The poem never explicitly states why the lantern was left burning. However, its persistence through the night and the later traveler finding meaning in it suggest that the light symbolizes <b>hope and guidance despite uncertainty</b>. The other choices introduce details that the poem does not support.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "What does the lantern most likely symbolize in the poem?<br><br><b>The Last Lantern</b><br><i>by Anonymous<br><br>At dusk, the village closed its doors,<br>While shadows climbed the silent floors.<br>One lantern burned beside the gate,<br>Though no one knew whom it would wait.<br><br>The road beyond was dark and long,<br>The wind had swallowed every song.<br>Yet through the night, the lantern stayed,<br>A little star the darkness made.<br><br>At dawn, a traveler reached the town,<br>His weary steps were dragging down.<br>He saw the light and understood:<br>Some hope remains where others would.</i>",
                options: ["The wealth and prosperity of the village", "The danger associated with traveling at night", "The loneliness experienced by the traveler", "The persistence of hope even when circumstances appear discouraging"],
                correct: 3,
				explanation: "Correct answer is <b>The persistence of hope even when circumstances appear discouraging</b>.<ul><li>The lantern remains lit while the village is closed, the road is dark, and the wind has “swallowed every song.” Its continued light contrasts with these negative conditions. The final lines reinforce this interpretation by connecting the light with <b>hope that remains when others have given up.</b></li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which statement is NOT a valid inference based on the poem?<br><br><b>The Last Lantern</b><br><i>by Anonymous<br><br>At dusk, the village closed its doors,<br>While shadows climbed the silent floors.<br>One lantern burned beside the gate,<br>Though no one knew whom it would wait.<br><br>The road beyond was dark and long,<br>The wind had swallowed every song.<br>Yet through the night, the lantern stayed,<br>A little star the darkness made.<br><br>At dawn, a traveler reached the town,<br>His weary steps were dragging down.<br>He saw the light and understood:<br>Some hope remains where others would.</i>",
                options: ["A seemingly small act can have significance to someone who is struggling.", "Hope can exist even when there is little evidence that circumstances will improve.", "The traveler had previously visited the village and knew exactly who had lit the lantern.", "The meaning of an act may become clearer to another person later."],
                correct: 2,
				explanation: "Correct answer is <b>The traveler had previously visited the village and knew exactly who had lit the lantern.</b>.<ul><li>The poem does <b>not</b> state or imply that the traveler had previously visited the village or knew who lit the lantern. In fact, the identity of the person who left it burning is deliberately unknown. Therefore, this statement cannot reasonably be inferred from the poem.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "What is the author's main argument regarding failure?<br><br><i>“A person who has never failed may appear fortunate, but such a person may also have avoided every opportunity that demanded courage. Failure is uncomfortable because it forces us to confront the distance between what we expected and what actually happened. Yet that discomfort can be useful. It reveals weaknesses that success often conceals and compels us to reconsider methods that we once believed were sufficient.<br><br>This does not mean that every failure automatically produces wisdom. Some people repeat the same mistakes because they refuse to examine them; others allow a single disappointment to define their abilities permanently. The value of failure depends largely on what follows it. When a person studies what went wrong, accepts responsibility where necessary, and adjusts accordingly, failure becomes information rather than a verdict. It does not prove that a person is incapable; it demonstrates that a particular approach did not produce the desired result.<br><br>Consequently, the wiser response to failure is neither to celebrate it nor to fear it excessively. It is to examine it honestly. A mistake that is carefully understood may prevent a larger mistake in the future, while an uncomfortable experience may eventually become the foundation of better judgment.”<br><br>— Anonymous</i>",
                options: ["Failure is unavoidable and therefore should simply be accepted.", "Failure can become useful when a person carefully examines it and learns from it.", "Failure is necessary for every person to achieve success.", "Failure is more valuable than success because it teaches more lessons."],
                correct: 1,
				explanation: "Correct answer is <b>Failure can become useful when a person carefully examines it and learns from it.</b>.<ul><li>The passage does not claim that failure is always necessary or more valuable than success. Instead, the author argues that failure <b>can become useful when it is honestly examined and used to improve future decisions or methods.</b></li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "What does the author imply by stating that “failure becomes information rather than a verdict”?<br><br><i>“A person who has never failed may appear fortunate, but such a person may also have avoided every opportunity that demanded courage. Failure is uncomfortable because it forces us to confront the distance between what we expected and what actually happened. Yet that discomfort can be useful. It reveals weaknesses that success often conceals and compels us to reconsider methods that we once believed were sufficient.<br><br>This does not mean that every failure automatically produces wisdom. Some people repeat the same mistakes because they refuse to examine them; others allow a single disappointment to define their abilities permanently. The value of failure depends largely on what follows it. When a person studies what went wrong, accepts responsibility where necessary, and adjusts accordingly, failure becomes information rather than a verdict. It does not prove that a person is incapable; it demonstrates that a particular approach did not produce the desired result.<br><br>Consequently, the wiser response to failure is neither to celebrate it nor to fear it excessively. It is to examine it honestly. A mistake that is carefully understood may prevent a larger mistake in the future, while an uncomfortable experience may eventually become the foundation of better judgment.”<br><br>— Anonymous</i>",
                options: ["Failure should be treated as proof that a person lacks ability.", "Failure provides information that should be hidden from other people.", "Failure can reveal what needs to be changed without determining a person's overall ability.", "Failure is meaningful only when other people recognize it."],
                correct: 2,
				explanation: "Correct answer is <b>Failure can reveal what needs to be changed without determining a person's overall ability.</b>.<ul><li>The word <b>“verdict”</b> suggests a final judgment. The author rejects the idea that one unsuccessful attempt permanently defines a person's ability. Instead, failure can provide <b>useful evidence about what went wrong and what may need to change</b>.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which of the following can BEST be inferred from the passage?<br><br><i>“A person who has never failed may appear fortunate, but such a person may also have avoided every opportunity that demanded courage. Failure is uncomfortable because it forces us to confront the distance between what we expected and what actually happened. Yet that discomfort can be useful. It reveals weaknesses that success often conceals and compels us to reconsider methods that we once believed were sufficient.<br><br>This does not mean that every failure automatically produces wisdom. Some people repeat the same mistakes because they refuse to examine them; others allow a single disappointment to define their abilities permanently. The value of failure depends largely on what follows it. When a person studies what went wrong, accepts responsibility where necessary, and adjusts accordingly, failure becomes information rather than a verdict. It does not prove that a person is incapable; it demonstrates that a particular approach did not produce the desired result.<br><br>Consequently, the wiser response to failure is neither to celebrate it nor to fear it excessively. It is to examine it honestly. A mistake that is carefully understood may prevent a larger mistake in the future, while an uncomfortable experience may eventually become the foundation of better judgment.”<br><br>— Anonymous</i>",
                options: ["People who experience repeated failures are more likely to become successful.", "The consequences of failure depend partly on how a person responds to the experience.", "People who accept responsibility for failure will never repeat their mistakes.", "Avoiding failure is generally more beneficial than learning from it."],
                correct: 1,
				explanation: "Correct answer is <b>The consequences of failure depend partly on how a person responds to the experience.</b>.<ul><li>The author specifically distinguishes between people who <b>examine their mistakes and adjust</b> and those who simply repeat them. This indicates that the outcome of failure depends partly on the individual's response to it. The passage does not guarantee that learning from failure will prevent all future mistakes.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Why does the author mention people who “repeat the same mistakes”?<br><br><i>“A person who has never failed may appear fortunate, but such a person may also have avoided every opportunity that demanded courage. Failure is uncomfortable because it forces us to confront the distance between what we expected and what actually happened. Yet that discomfort can be useful. It reveals weaknesses that success often conceals and compels us to reconsider methods that we once believed were sufficient.<br><br>This does not mean that every failure automatically produces wisdom. Some people repeat the same mistakes because they refuse to examine them; others allow a single disappointment to define their abilities permanently. The value of failure depends largely on what follows it. When a person studies what went wrong, accepts responsibility where necessary, and adjusts accordingly, failure becomes information rather than a verdict. It does not prove that a person is incapable; it demonstrates that a particular approach did not produce the desired result.<br><br>Consequently, the wiser response to failure is neither to celebrate it nor to fear it excessively. It is to examine it honestly. A mistake that is carefully understood may prevent a larger mistake in the future, while an uncomfortable experience may eventually become the foundation of better judgment.”<br><br>— Anonymous</i>",
                options: ["To prove that failure is usually caused by carelessness.", "To argue that people should avoid taking responsibility for failure.", "To demonstrate that repeated failure is more beneficial than success.", "To qualify the idea that failure automatically leads to wisdom."],
                correct: 3,
				explanation: "Correct answer is <b>To qualify the idea that failure automatically leads to wisdom.</b>.<ul><li>Earlier, the author explains that failure <b>can</b> teach valuable lessons. The example of people repeating the same mistakes adds an important qualification: failure itself does not guarantee learning. <b>Reflection and adjustment are necessary</b> for the experience to become useful.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which title BEST captures the central idea of the passage?<br><br><i>“A person who has never failed may appear fortunate, but such a person may also have avoided every opportunity that demanded courage. Failure is uncomfortable because it forces us to confront the distance between what we expected and what actually happened. Yet that discomfort can be useful. It reveals weaknesses that success often conceals and compels us to reconsider methods that we once believed were sufficient.<br><br>This does not mean that every failure automatically produces wisdom. Some people repeat the same mistakes because they refuse to examine them; others allow a single disappointment to define their abilities permanently. The value of failure depends largely on what follows it. When a person studies what went wrong, accepts responsibility where necessary, and adjusts accordingly, failure becomes information rather than a verdict. It does not prove that a person is incapable; it demonstrates that a particular approach did not produce the desired result.<br><br>Consequently, the wiser response to failure is neither to celebrate it nor to fear it excessively. It is to examine it honestly. A mistake that is carefully understood may prevent a larger mistake in the future, while an uncomfortable experience may eventually become the foundation of better judgment.”<br><br>— Anonymous</i>",
                options: ["The Inevitability of Failure", "Why Successful People Never Fear Failure", "Learning From Failure: Turning Mistakes Into Better Judgment", "The Superiority of Failure Over Success"],
                correct: 2,
				explanation: "Correct answer is <b>Learning From Failure: Turning Mistakes Into Better Judgment</b>.<ul><li>The passage focuses on how failure can provide information, reveal weaknesses, and improve future judgment <b>when properly examined</b>. Therefore, the title in the answer captures the passage's central idea more completely than titles that merely discuss the existence or inevitability of failure.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which statement best explains why hair may appear longer after a person's death, despite the cessation of cellular activity?<br><br><b>Hair Growth After Death</b><br><br><i>Hair and nails are often believed to continue growing after a person dies. However, this appearance is primarily caused by changes in the body's tissues rather than continued biological growth. After death, the body loses its ability to maintain normal circulation, and cells can no longer receive the oxygen and nutrients required for sustained activity.<br><br>Hair growth depends on specialized cells located at the base of the hair follicle. These cells undergo mitosis, producing new cells that gradually become elongated, hardened, and filled with pigment. As these cells are pushed upward, they form the hair shaft. The visible portion of the hair consists largely of dead, keratinized cells that no longer carry out metabolic activities.<br><br>When a person dies, the soft tissues surrounding the hair follicle lose water through dehydration. As the skin dries and contracts, more of the hair shaft may become exposed, creating the illusion that the hair has grown. Similarly, changes in the skin around the fingernails can make nails appear longer after death.<br><br>The production of new hair cells requires energy and nutrients delivered through the bloodstream. Without adequate nourishment and oxygen, the living cells at the follicle's base can no longer sustain cell division. Therefore, genuine hair growth cannot continue indefinitely after death.<br><br>- Adapted from biological concepts on cell division, keratinization, and postmortem changes.</i>",
                options: ["The hair follicle continues producing new cells because keratinized cells do not require oxygen.", "The hair shaft absorbs water from surrounding tissues, causing it to expand.", "The contraction and dehydration of surrounding skin expose more of the existing hair shaft.", "The dead cells in the hair shaft regain their ability to divide and multiply."],
                correct: 2,
				explanation: "Correct answer is <b>The contraction and dehydration of surrounding skin expose more of the existing hair shaft.</b>.<ul><li>After death, the skin loses water and contracts, exposing more of the existing hair shaft. The hair itself does not resume cell division, because the living follicle cells no longer receive the necessary oxygen and nutrients.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which sequence most accurately describes the process responsible for the formation of the hair shaft during normal hair growth?<br><br><b>Hair Growth After Death</b><br><br><i>Hair and nails are often believed to continue growing after a person dies. However, this appearance is primarily caused by changes in the body's tissues rather than continued biological growth. After death, the body loses its ability to maintain normal circulation, and cells can no longer receive the oxygen and nutrients required for sustained activity.<br><br>Hair growth depends on specialized cells located at the base of the hair follicle. These cells undergo mitosis, producing new cells that gradually become elongated, hardened, and filled with pigment. As these cells are pushed upward, they form the hair shaft. The visible portion of the hair consists largely of dead, keratinized cells that no longer carry out metabolic activities.<br><br>When a person dies, the soft tissues surrounding the hair follicle lose water through dehydration. As the skin dries and contracts, more of the hair shaft may become exposed, creating the illusion that the hair has grown. Similarly, changes in the skin around the fingernails can make nails appear longer after death.<br><br>The production of new hair cells requires energy and nutrients delivered through the bloodstream. Without adequate nourishment and oxygen, the living cells at the follicle's base can no longer sustain cell division. Therefore, genuine hair growth cannot continue indefinitely after death.<br><br>- Adapted from biological concepts on cell division, keratinization, and postmortem changes.</i>",
                options: ["Keratinization → mitosis → pigment removal → upward movement.", "Mitosis → cell elongation and keratinization → pigmentation → upward movement into the hair shaft.", "Pigmentation → cell death → mitosis → absorption of nutrients by the hair shaft.", "Cell hardening → blood circulation → mitosis → formation of new follicle layers."],
                correct: 1,
				explanation: "Correct answer is <b>Mitosis → cell elongation and keratinization → pigmentation → upward movement into the hair shaft.</b>.<ul><li>Cells at the base of the follicle multiply through mitosis. As they move upward, they elongate, become keratinized, and acquire pigment. These changes contribute to the formation of the hair shaft.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Suppose the bloodstream stops delivering oxygen and nutrients to the soft cells at the base of a hair follicle, but the already formed hair shaft remains intact. What is the most likely immediate consequence?<br><br><b>Hair Growth After Death</b><br><br><i>Hair and nails are often believed to continue growing after a person dies. However, this appearance is primarily caused by changes in the body's tissues rather than continued biological growth. After death, the body loses its ability to maintain normal circulation, and cells can no longer receive the oxygen and nutrients required for sustained activity.<br><br>Hair growth depends on specialized cells located at the base of the hair follicle. These cells undergo mitosis, producing new cells that gradually become elongated, hardened, and filled with pigment. As these cells are pushed upward, they form the hair shaft. The visible portion of the hair consists largely of dead, keratinized cells that no longer carry out metabolic activities.<br><br>When a person dies, the soft tissues surrounding the hair follicle lose water through dehydration. As the skin dries and contracts, more of the hair shaft may become exposed, creating the illusion that the hair has grown. Similarly, changes in the skin around the fingernails can make nails appear longer after death.<br><br>The production of new hair cells requires energy and nutrients delivered through the bloodstream. Without adequate nourishment and oxygen, the living cells at the follicle's base can no longer sustain cell division. Therefore, genuine hair growth cannot continue indefinitely after death.<br><br>- Adapted from biological concepts on cell division, keratinization, and postmortem changes.</i>",
                options: ["The hair shaft will rapidly dissolve because its cells are no longer living.", "The follicle will begin producing new cells using stored pigment instead of energy.", "The hair shaft will immediately turn white because all pigment disappears.", "The production of new hair cells will decline or stop, while the existing hair shaft remains present."],
                correct: 3,
				explanation: "Correct answer is <b>The production of new hair cells will decline or stop, while the existing hair shaft remains present.</b>.<ul><li>The living cells at the follicle's base require oxygen and nutrients to produce new cells. When nourishment stops, cell division cannot be maintained. However, the already formed hair shaft consists largely of keratinized cells and does not immediately disappear.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which conclusion can be logically inferred from the passage about the relationship between living cells and the visible hair shaft?<br><br><b>Hair Growth After Death</b><br><br><i>Hair and nails are often believed to continue growing after a person dies. However, this appearance is primarily caused by changes in the body's tissues rather than continued biological growth. After death, the body loses its ability to maintain normal circulation, and cells can no longer receive the oxygen and nutrients required for sustained activity.<br><br>Hair growth depends on specialized cells located at the base of the hair follicle. These cells undergo mitosis, producing new cells that gradually become elongated, hardened, and filled with pigment. As these cells are pushed upward, they form the hair shaft. The visible portion of the hair consists largely of dead, keratinized cells that no longer carry out metabolic activities.<br><br>When a person dies, the soft tissues surrounding the hair follicle lose water through dehydration. As the skin dries and contracts, more of the hair shaft may become exposed, creating the illusion that the hair has grown. Similarly, changes in the skin around the fingernails can make nails appear longer after death.<br><br>The production of new hair cells requires energy and nutrients delivered through the bloodstream. Without adequate nourishment and oxygen, the living cells at the follicle's base can no longer sustain cell division. Therefore, genuine hair growth cannot continue indefinitely after death.<br><br>- Adapted from biological concepts on cell division, keratinization, and postmortem changes.</i>",
                options: ["All cells in the hair shaft remain alive and continue dividing throughout a person's life.", "The visible hair shaft is the primary location where nutrients enter the hair follicle.", "The continued formation of hair depends on living cells in the follicle, even though the visible hair shaft is largely composed of nonliving cells.", "The hair shaft can independently produce energy to replace the cells lost during normal growth."],
                correct: 2,
				explanation: "Correct answer is <b>The continued formation of hair depends on living cells in the follicle, even though the visible hair shaft is largely composed of nonliving cells.</b>.<ul><li>Hair growth depends on the living, dividing cells at the base of the follicle. The visible hair shaft is largely composed of keratinized cells, which do not independently produce energy or undergo cell division. This distinction explains why the follicle, rather than the shaft itself, is responsible for hair growth.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "A researcher observes that a deceased person's hair appears longer several hours after death. Which additional observation would provide the strongest evidence that the apparent growth is caused by skin contraction rather than continued hair production?<br><br><b>Hair Growth After Death</b><br><br><i>Hair and nails are often believed to continue growing after a person dies. However, this appearance is primarily caused by changes in the body's tissues rather than continued biological growth. After death, the body loses its ability to maintain normal circulation, and cells can no longer receive the oxygen and nutrients required for sustained activity.<br><br>Hair growth depends on specialized cells located at the base of the hair follicle. These cells undergo mitosis, producing new cells that gradually become elongated, hardened, and filled with pigment. As these cells are pushed upward, they form the hair shaft. The visible portion of the hair consists largely of dead, keratinized cells that no longer carry out metabolic activities.<br><br>When a person dies, the soft tissues surrounding the hair follicle lose water through dehydration. As the skin dries and contracts, more of the hair shaft may become exposed, creating the illusion that the hair has grown. Similarly, changes in the skin around the fingernails can make nails appear longer after death.<br><br>The production of new hair cells requires energy and nutrients delivered through the bloodstream. Without adequate nourishment and oxygen, the living cells at the follicle's base can no longer sustain cell division. Therefore, genuine hair growth cannot continue indefinitely after death.<br><br>- Adapted from biological concepts on cell division, keratinization, and postmortem changes.</i>",
                options: ["The hair has become darker in color.", "The hair shaft has increased in thickness.", "The surrounding skin has visibly dried and contracted, while there is no evidence of new cell formation at the follicle's base.", "The hair shaft contains keratinized cells."],
                correct: 2,
				explanation: "Correct answer is <b>The surrounding skin has visibly dried and contracted, while there is no evidence of new cell formation at the follicle's base.</b>.<ul><li>Skin dehydration and contraction can expose more of the existing hair shaft. Observing these changes alongside the absence of new cell formation supports the explanation that the apparent increase in length is an illusion rather than genuine growth.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which statement best explains the Stoic distinction between things within and beyond human control?<br><br><b>Stoicism: The Pursuit of Virtue and Inner Freedom</b><br><br><i>Stoicism was a philosophical school founded by Zeno of Citium in Athens during the early third century B.C. Its teachings emphasized the development of virtue, rational judgment, and self-control as the foundations of a meaningful life. Unlike philosophies that identified happiness primarily with pleasure, the Stoics maintained that true happiness depended on living in accordance with reason and nature.<br><br>The Stoics distinguished between things within human control and things beyond it. A person's judgments, choices, intentions, and responses were considered subject to personal control, whereas wealth, reputation, physical health, and the actions of other people were generally regarded as external circumstances. This distinction did not mean that external things were entirely irrelevant, but rather that they should not determine a person's moral worth or inner peace.<br><br>According to Stoic thought, the universe was governed by a rational ordering principle called the logos. Human beings, as rational creatures, were expected to align their conduct with this universal order. Adversity, therefore, was not necessarily an evil in itself. Instead, difficulties could provide opportunities to exercise courage, patience, justice, and wisdom.<br><br>Stoicism did not require people to suppress all emotions or become indifferent to suffering. Rather, it encouraged individuals to examine the judgments underlying their emotional responses. Fear, anger, and excessive desire could arise from mistaken beliefs about what was truly good or harmful. By cultivating rational judgment, a person could respond to circumstances with greater composure.<br><br>The Stoic ideal of freedom was consequently not the ability to control every external event, but the ability to maintain moral independence despite changing conditions. A person who pursues virtue does not become invulnerable to hardship, but learns to prevent hardship from determining the quality of their character. In this sense, Stoicism presents self-mastery as a form of freedom that depends primarily on the individual's own choices.<br><br>- Adapted from historical concepts of Stoic philosophy.</i>",
                options: ["Individuals should disregard all external circumstances because they have no practical significance.", "People can achieve complete happiness by controlling their wealth, reputation, and physical health.", "Moral responsibility primarily concerns one's judgments and choices, while external circumstances should not determine one's virtue.", "Human beings are incapable of making meaningful decisions because the universe is governed by the logos."],
                correct: 2,
				explanation: "Correct answer is <b>Moral responsibility primarily concerns one's judgments and choices, while external circumstances should not determine one's virtue.</b>.<ul><li>Stoicism distinguishes personal choices and judgments from external circumstances. Although external conditions may matter practically, a person's moral worth depends primarily on how they respond to those conditions.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "If a Stoic experiences an unexpected financial loss, which response would most closely reflect the philosophy described in the passage?<br><br><b>Stoicism: The Pursuit of Virtue and Inner Freedom</b><br><br><i>Stoicism was a philosophical school founded by Zeno of Citium in Athens during the early third century B.C. Its teachings emphasized the development of virtue, rational judgment, and self-control as the foundations of a meaningful life. Unlike philosophies that identified happiness primarily with pleasure, the Stoics maintained that true happiness depended on living in accordance with reason and nature.<br><br>The Stoics distinguished between things within human control and things beyond it. A person's judgments, choices, intentions, and responses were considered subject to personal control, whereas wealth, reputation, physical health, and the actions of other people were generally regarded as external circumstances. This distinction did not mean that external things were entirely irrelevant, but rather that they should not determine a person's moral worth or inner peace.<br><br>According to Stoic thought, the universe was governed by a rational ordering principle called the logos. Human beings, as rational creatures, were expected to align their conduct with this universal order. Adversity, therefore, was not necessarily an evil in itself. Instead, difficulties could provide opportunities to exercise courage, patience, justice, and wisdom.<br><br>Stoicism did not require people to suppress all emotions or become indifferent to suffering. Rather, it encouraged individuals to examine the judgments underlying their emotional responses. Fear, anger, and excessive desire could arise from mistaken beliefs about what was truly good or harmful. By cultivating rational judgment, a person could respond to circumstances with greater composure.<br><br>The Stoic ideal of freedom was consequently not the ability to control every external event, but the ability to maintain moral independence despite changing conditions. A person who pursues virtue does not become invulnerable to hardship, but learns to prevent hardship from determining the quality of their character. In this sense, Stoicism presents self-mastery as a form of freedom that depends primarily on the individual's own choices.<br><br>- Adapted from historical concepts of Stoic philosophy.</i>",
                options: ["Concluding that the loss proves that life is fundamentally unjust and meaningless.", "Suppressing all emotional reactions and refusing to acknowledge the consequences of the loss.", "Pursuing wealth more aggressively to ensure that future hardships become impossible.", "Acknowledging the loss, evaluating its practical consequences, and focusing on responding with reason and integrity."],
                correct: 3,
				explanation: "Correct answer is <b>Acknowledging the loss, evaluating its practical consequences, and focusing on responding with reason and integrity.</b>.<ul><li>Stoicism does not require a person to deny hardship or ignore practical problems. Instead, the individual should recognize what happened, distinguish what can be controlled, and respond through rational judgment and virtuous action.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which inference best explains why Stoics regarded adversity as an opportunity for moral development?<br><br><b>Stoicism: The Pursuit of Virtue and Inner Freedom</b><br><br><i>Stoicism was a philosophical school founded by Zeno of Citium in Athens during the early third century B.C. Its teachings emphasized the development of virtue, rational judgment, and self-control as the foundations of a meaningful life. Unlike philosophies that identified happiness primarily with pleasure, the Stoics maintained that true happiness depended on living in accordance with reason and nature.<br><br>The Stoics distinguished between things within human control and things beyond it. A person's judgments, choices, intentions, and responses were considered subject to personal control, whereas wealth, reputation, physical health, and the actions of other people were generally regarded as external circumstances. This distinction did not mean that external things were entirely irrelevant, but rather that they should not determine a person's moral worth or inner peace.<br><br>According to Stoic thought, the universe was governed by a rational ordering principle called the logos. Human beings, as rational creatures, were expected to align their conduct with this universal order. Adversity, therefore, was not necessarily an evil in itself. Instead, difficulties could provide opportunities to exercise courage, patience, justice, and wisdom.<br><br>Stoicism did not require people to suppress all emotions or become indifferent to suffering. Rather, it encouraged individuals to examine the judgments underlying their emotional responses. Fear, anger, and excessive desire could arise from mistaken beliefs about what was truly good or harmful. By cultivating rational judgment, a person could respond to circumstances with greater composure.<br><br>The Stoic ideal of freedom was consequently not the ability to control every external event, but the ability to maintain moral independence despite changing conditions. A person who pursues virtue does not become invulnerable to hardship, but learns to prevent hardship from determining the quality of their character. In this sense, Stoicism presents self-mastery as a form of freedom that depends primarily on the individual's own choices.<br><br>- Adapted from historical concepts of Stoic philosophy.</i>",
                options: ["Adversity guarantees that individuals will become virtuous regardless of their choices.", "Difficult circumstances can reveal and develop a person's ability to exercise virtues such as courage, patience, and wisdom.", "Suffering is inherently valuable, even when it results from immoral decisions.", "People can eliminate all hardship by aligning themselves perfectly with the logos."],
                correct: 1,
				explanation: "Correct answer is <b>Difficult circumstances can reveal and develop a person's ability to exercise virtues such as courage, patience, and wisdom.</b>.<ul><li>XXX</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which statement most accurately distinguishes Stoic emotional discipline from the complete suppression of emotions?<br><br><b>Stoicism: The Pursuit of Virtue and Inner Freedom</b><br><br><i>Stoicism was a philosophical school founded by Zeno of Citium in Athens during the early third century B.C. Its teachings emphasized the development of virtue, rational judgment, and self-control as the foundations of a meaningful life. Unlike philosophies that identified happiness primarily with pleasure, the Stoics maintained that true happiness depended on living in accordance with reason and nature.<br><br>The Stoics distinguished between things within human control and things beyond it. A person's judgments, choices, intentions, and responses were considered subject to personal control, whereas wealth, reputation, physical health, and the actions of other people were generally regarded as external circumstances. This distinction did not mean that external things were entirely irrelevant, but rather that they should not determine a person's moral worth or inner peace.<br><br>According to Stoic thought, the universe was governed by a rational ordering principle called the logos. Human beings, as rational creatures, were expected to align their conduct with this universal order. Adversity, therefore, was not necessarily an evil in itself. Instead, difficulties could provide opportunities to exercise courage, patience, justice, and wisdom.<br><br>Stoicism did not require people to suppress all emotions or become indifferent to suffering. Rather, it encouraged individuals to examine the judgments underlying their emotional responses. Fear, anger, and excessive desire could arise from mistaken beliefs about what was truly good or harmful. By cultivating rational judgment, a person could respond to circumstances with greater composure.<br><br>The Stoic ideal of freedom was consequently not the ability to control every external event, but the ability to maintain moral independence despite changing conditions. A person who pursues virtue does not become invulnerable to hardship, but learns to prevent hardship from determining the quality of their character. In this sense, Stoicism presents self-mastery as a form of freedom that depends primarily on the individual's own choices.<br><br>- Adapted from historical concepts of Stoic philosophy.</i>",
                options: ["Stoics believed that emotions should always be expressed without restriction.", "Stoics considered all emotions irrational and believed they could be eliminated through physical training.", "Stoics encouraged individuals to examine the judgments behind their emotions rather than simply denying or blindly following emotional reactions.", "Stoics believed that emotional responses were entirely determined by external events and could not be changed."],
                correct: 2,
				explanation: "Correct answer is <b>Stoics encouraged individuals to examine the judgments behind their emotions rather than simply denying or blindly following emotional reactions.</b>.<ul><li>Stoicism emphasizes examining the beliefs and judgments that influence emotional responses. Its goal is rational regulation rather than simply denying the existence of emotions or reacting without reflection.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which situation most clearly illustrates the Stoic concept of freedom as moral independence?<br><br><b>Stoicism: The Pursuit of Virtue and Inner Freedom</b><br><br><i>Stoicism was a philosophical school founded by Zeno of Citium in Athens during the early third century B.C. Its teachings emphasized the development of virtue, rational judgment, and self-control as the foundations of a meaningful life. Unlike philosophies that identified happiness primarily with pleasure, the Stoics maintained that true happiness depended on living in accordance with reason and nature.<br><br>The Stoics distinguished between things within human control and things beyond it. A person's judgments, choices, intentions, and responses were considered subject to personal control, whereas wealth, reputation, physical health, and the actions of other people were generally regarded as external circumstances. This distinction did not mean that external things were entirely irrelevant, but rather that they should not determine a person's moral worth or inner peace.<br><br>According to Stoic thought, the universe was governed by a rational ordering principle called the logos. Human beings, as rational creatures, were expected to align their conduct with this universal order. Adversity, therefore, was not necessarily an evil in itself. Instead, difficulties could provide opportunities to exercise courage, patience, justice, and wisdom.<br><br>Stoicism did not require people to suppress all emotions or become indifferent to suffering. Rather, it encouraged individuals to examine the judgments underlying their emotional responses. Fear, anger, and excessive desire could arise from mistaken beliefs about what was truly good or harmful. By cultivating rational judgment, a person could respond to circumstances with greater composure.<br><br>The Stoic ideal of freedom was consequently not the ability to control every external event, but the ability to maintain moral independence despite changing conditions. A person who pursues virtue does not become invulnerable to hardship, but learns to prevent hardship from determining the quality of their character. In this sense, Stoicism presents self-mastery as a form of freedom that depends primarily on the individual's own choices.<br><br>- Adapted from historical concepts of Stoic philosophy.</i>",
                options: ["A person gains political authority and uses it to control the decisions of others.", "A wealthy individual avoids all difficulties by acquiring enough resources to eliminate uncertainty.", "A person refuses to take responsibility for their actions because external events determine everything.", "A person remains committed to acting honestly despite pressure from others to compromise their principles."],
                correct: 0,
				explanation: "Correct answer is <b>A person remains committed to acting honestly despite pressure from others to compromise their principles.</b>.<ul><li>Stoic freedom is based on maintaining control over one's moral choices. Acting honestly despite external pressure demonstrates independence of judgment and commitment to virtue, regardless of the consequences imposed by others.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which statement best captures Seneca's underlying argument about the relationship between external possessions and happiness?<br><br><b>The Happy Life: Wisdom, Virtue, and Self-Mastery</b><br><br><i>According to Seneca, a happy life cannot be measured by the abundance of possessions, the approval of others, or the satisfaction of every desire. True happiness arises from a soul that remains faithful to reason and is not governed by the instability of external circumstances. A person who depends entirely on wealth, reputation, or pleasure places their peace in the hands of forces that may change without warning.<br><br>The wise individual, therefore, seeks not to control everything that happens but to govern their own judgments and responses. This does not mean abandoning responsibility or refusing to participate in society. Rather, it requires distinguishing between what is genuinely valuable and what merely appears desirable. Wealth may provide comfort, but it does not automatically produce wisdom. Poverty may create difficulty, but it does not necessarily destroy a person's dignity.<br><br>Seneca argues that virtue must remain the foundation of happiness. A person cannot achieve a truly good life by combining honorable intentions with dishonest actions, even when those actions produce temporary advantages. The quality of a person's character is determined by the principles guiding their conduct, not simply by the outcomes they obtain.<br><br>Moreover, the wise person does not pursue pleasure as the highest authority over every decision. Pleasure may accompany a virtuous life, but it should not become the standard by which every action is judged. When pleasure conflicts with reason and moral duty, the individual must be willing to reject it. Such self-mastery enables a person to remain consistent even when faced with temptation, loss, or public disapproval.<br><br>The happy life, in this understanding, is not a life free from every difficulty. It is a life in which the soul maintains its integrity, exercises sound judgment, and remains committed to what is honorable. External circumstances may influence comfort and convenience, but they should not determine the ultimate worth of a human being.<br><br>- Adapted from Stoic philosophical principles associated with Seneca.</i>",
                options: ["External possessions are harmful because they prevent individuals from developing any meaningful relationships.", "Happiness is achieved when a person acquires enough wealth to eliminate all possible difficulties.", "External possessions may contribute to comfort, but lasting happiness depends on the individual's character and rational judgment.", "A person must reject all material possessions to demonstrate genuine wisdom."],
                correct: 2,
				explanation: "Correct answer is <b>External possessions may contribute to comfort, but lasting happiness depends on the individual's character and rational judgment.</b>.<ul><li>Seneca distinguishes external advantages from the foundations of happiness. Wealth and comfort may be useful, but they cannot guarantee a virtuous character or lasting peace. Happiness depends primarily on how an individual governs their judgments and actions.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which situation most clearly demonstrates the distinction between an external outcome and moral virtue described in the passage?<br><br><b>The Happy Life: Wisdom, Virtue, and Self-Mastery</b><br><br><i>According to Seneca, a happy life cannot be measured by the abundance of possessions, the approval of others, or the satisfaction of every desire. True happiness arises from a soul that remains faithful to reason and is not governed by the instability of external circumstances. A person who depends entirely on wealth, reputation, or pleasure places their peace in the hands of forces that may change without warning.<br><br>The wise individual, therefore, seeks not to control everything that happens but to govern their own judgments and responses. This does not mean abandoning responsibility or refusing to participate in society. Rather, it requires distinguishing between what is genuinely valuable and what merely appears desirable. Wealth may provide comfort, but it does not automatically produce wisdom. Poverty may create difficulty, but it does not necessarily destroy a person's dignity.<br><br>Seneca argues that virtue must remain the foundation of happiness. A person cannot achieve a truly good life by combining honorable intentions with dishonest actions, even when those actions produce temporary advantages. The quality of a person's character is determined by the principles guiding their conduct, not simply by the outcomes they obtain.<br><br>Moreover, the wise person does not pursue pleasure as the highest authority over every decision. Pleasure may accompany a virtuous life, but it should not become the standard by which every action is judged. When pleasure conflicts with reason and moral duty, the individual must be willing to reject it. Such self-mastery enables a person to remain consistent even when faced with temptation, loss, or public disapproval.<br><br>The happy life, in this understanding, is not a life free from every difficulty. It is a life in which the soul maintains its integrity, exercises sound judgment, and remains committed to what is honorable. External circumstances may influence comfort and convenience, but they should not determine the ultimate worth of a human being.<br><br>- Adapted from Stoic philosophical principles associated with Seneca.</i>",
                options: ["A person donates money publicly to gain recognition but receives praise from the community.", "A person avoids all difficult decisions to ensure that their life remains comfortable.", "A person pursues wealth and reputation because these are the only reliable sources of happiness.", "A person refuses to engage in dishonest business practices even when doing so would result in significant financial gain."],
                correct: 3,
				explanation: "Correct answer is <b>A person refuses to engage in dishonest business practices even when doing so would result in significant financial gain.</b>.<ul><li>The passage states that virtue must remain the foundation of happiness. Choosing honesty despite financial loss demonstrates that moral principles take priority over temporary external advantages.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which inference is most strongly supported by Seneca's discussion of pleasure and reason?<br><br><b>The Happy Life: Wisdom, Virtue, and Self-Mastery</b><br><br><i>According to Seneca, a happy life cannot be measured by the abundance of possessions, the approval of others, or the satisfaction of every desire. True happiness arises from a soul that remains faithful to reason and is not governed by the instability of external circumstances. A person who depends entirely on wealth, reputation, or pleasure places their peace in the hands of forces that may change without warning.<br><br>The wise individual, therefore, seeks not to control everything that happens but to govern their own judgments and responses. This does not mean abandoning responsibility or refusing to participate in society. Rather, it requires distinguishing between what is genuinely valuable and what merely appears desirable. Wealth may provide comfort, but it does not automatically produce wisdom. Poverty may create difficulty, but it does not necessarily destroy a person's dignity.<br><br>Seneca argues that virtue must remain the foundation of happiness. A person cannot achieve a truly good life by combining honorable intentions with dishonest actions, even when those actions produce temporary advantages. The quality of a person's character is determined by the principles guiding their conduct, not simply by the outcomes they obtain.<br><br>Moreover, the wise person does not pursue pleasure as the highest authority over every decision. Pleasure may accompany a virtuous life, but it should not become the standard by which every action is judged. When pleasure conflicts with reason and moral duty, the individual must be willing to reject it. Such self-mastery enables a person to remain consistent even when faced with temptation, loss, or public disapproval.<br><br>The happy life, in this understanding, is not a life free from every difficulty. It is a life in which the soul maintains its integrity, exercises sound judgment, and remains committed to what is honorable. External circumstances may influence comfort and convenience, but they should not determine the ultimate worth of a human being.<br><br>- Adapted from Stoic philosophical principles associated with Seneca.</i>",
                options: ["Pleasure is always incompatible with a virtuous life and must therefore be avoided.", "A person who experiences pleasure cannot possess wisdom or moral integrity.", "Pleasure becomes morally problematic when it overrides rational judgment and causes a person to abandon their principles", "Individuals should pursue every pleasurable experience because pleasure naturally leads to happiness."],
                correct: 2,
				explanation: "Correct answer is <b>Pleasure becomes morally problematic when it overrides rational judgment and causes a person to abandon their principles</b>.<ul><li>Seneca does not claim that all pleasure is harmful. Instead, he argues that pleasure should not govern every decision. When pleasure conflicts with reason and moral duty, a virtuous person must be prepared to reject it.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "A person remains calm after losing social status because they believe their moral worth depends on their character rather than public approval. Which philosophical principle does this behavior most directly illustrate?<br><br><b>The Happy Life: Wisdom, Virtue, and Self-Mastery</b><br><br><i>According to Seneca, a happy life cannot be measured by the abundance of possessions, the approval of others, or the satisfaction of every desire. True happiness arises from a soul that remains faithful to reason and is not governed by the instability of external circumstances. A person who depends entirely on wealth, reputation, or pleasure places their peace in the hands of forces that may change without warning.<br><br>The wise individual, therefore, seeks not to control everything that happens but to govern their own judgments and responses. This does not mean abandoning responsibility or refusing to participate in society. Rather, it requires distinguishing between what is genuinely valuable and what merely appears desirable. Wealth may provide comfort, but it does not automatically produce wisdom. Poverty may create difficulty, but it does not necessarily destroy a person's dignity.<br><br>Seneca argues that virtue must remain the foundation of happiness. A person cannot achieve a truly good life by combining honorable intentions with dishonest actions, even when those actions produce temporary advantages. The quality of a person's character is determined by the principles guiding their conduct, not simply by the outcomes they obtain.<br><br>Moreover, the wise person does not pursue pleasure as the highest authority over every decision. Pleasure may accompany a virtuous life, but it should not become the standard by which every action is judged. When pleasure conflicts with reason and moral duty, the individual must be willing to reject it. Such self-mastery enables a person to remain consistent even when faced with temptation, loss, or public disapproval.<br><br>The happy life, in this understanding, is not a life free from every difficulty. It is a life in which the soul maintains its integrity, exercises sound judgment, and remains committed to what is honorable. External circumstances may influence comfort and convenience, but they should not determine the ultimate worth of a human being.<br><br>- Adapted from Stoic philosophical principles associated with Seneca.</i>",
                options: ["Happiness depends on eliminating all relationships with society.", "External recognition is the highest measure of a person's virtue.", "A person must avoid every situation that could result in public criticism.", "Moral independence allows individuals to preserve their integrity despite changing external circumstances."],
                correct: 3,
				explanation: "Correct answer is <b>Moral independence allows individuals to preserve their integrity despite changing external circumstances.</b>.<ul><li>The passage explains that external circumstances should not determine a person's ultimate worth. Maintaining integrity despite the loss of reputation illustrates moral independence and the Stoic emphasis on self-governance.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which statement would most directly contradict the central philosophical position presented in the passage?<br><br><b>The Happy Life: Wisdom, Virtue, and Self-Mastery</b><br><br><i>According to Seneca, a happy life cannot be measured by the abundance of possessions, the approval of others, or the satisfaction of every desire. True happiness arises from a soul that remains faithful to reason and is not governed by the instability of external circumstances. A person who depends entirely on wealth, reputation, or pleasure places their peace in the hands of forces that may change without warning.<br><br>The wise individual, therefore, seeks not to control everything that happens but to govern their own judgments and responses. This does not mean abandoning responsibility or refusing to participate in society. Rather, it requires distinguishing between what is genuinely valuable and what merely appears desirable. Wealth may provide comfort, but it does not automatically produce wisdom. Poverty may create difficulty, but it does not necessarily destroy a person's dignity.<br><br>Seneca argues that virtue must remain the foundation of happiness. A person cannot achieve a truly good life by combining honorable intentions with dishonest actions, even when those actions produce temporary advantages. The quality of a person's character is determined by the principles guiding their conduct, not simply by the outcomes they obtain.<br><br>Moreover, the wise person does not pursue pleasure as the highest authority over every decision. Pleasure may accompany a virtuous life, but it should not become the standard by which every action is judged. When pleasure conflicts with reason and moral duty, the individual must be willing to reject it. Such self-mastery enables a person to remain consistent even when faced with temptation, loss, or public disapproval.<br><br>The happy life, in this understanding, is not a life free from every difficulty. It is a life in which the soul maintains its integrity, exercises sound judgment, and remains committed to what is honorable. External circumstances may influence comfort and convenience, but they should not determine the ultimate worth of a human being.<br><br>- Adapted from Stoic philosophical principles associated with Seneca.</i>",
                options: ["A person's happiness is ultimately determined by the amount of pleasure, wealth, and social recognition they accumulate.", "A person should evaluate desires through reason before acting on them.", "A virtuous character is more important than temporary financial success.", "Difficult circumstances do not necessarily destroy a person's dignity."],
                correct: 0,
				explanation: "Correct answer is <b>A person's happiness is ultimately determined by the amount of pleasure, wealth, and social recognition they accumulate.</b>.<ul><li>The passage rejects the idea that external success and pleasure are the ultimate foundations of happiness. It argues that a good life depends on virtue, rational judgment, and maintaining integrity regardless of external circumstances.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which statement best expresses the poem's central theme?<br><br><b>The Gift of Love</b><br><br><i>Not in the gold that morning gathers,<br>Nor in the roses dressed in rain,<br>But in the hands that bear the burden,<br>And choose to shelter others' pain.<br>Love is not merely whispered softly,<br>Nor sealed within a vow of grace;<br>It lives within the quiet choices<br>That ask no witness, seek no praise.<br>And if the road should turn to sorrow,<br>And time should steal what hearts hold dear,<br>The truest love is not diminished—<br>It makes its presence stronger there.<br>For love, when freely given wholly,<br>Demands no chain, commands no claim;<br>It gives itself without possession,<br>And leaves the soul transformed by flame.<br><br>- Original poem created for reading comprehension practice.</i>",
                options: ["Love is most meaningful when it is publicly recognized and rewarded.", "Love depends on the permanence of relationships and the absence of suffering.", "Genuine love is demonstrated through selfless actions and remains meaningful even when circumstances become difficult.", "Love is primarily a feeling that should be expressed through romantic promises."],
                correct: 2,
				explanation: "Correct answer is <b>Genuine love is demonstrated through selfless actions and remains meaningful even when circumstances become difficult.</b>.<ul><li>The poem contrasts superficial expressions of love with actions involving sacrifice, patience, and selflessness. The speaker emphasizes that genuine love remains meaningful even in the presence of sorrow and loss.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "What is the most significant effect of the contrast between ❝the gold that morning gathers❞ and ❝the hands that bear the burden❞?<br><br><b>The Gift of Love</b><br><br><i>Not in the gold that morning gathers,<br>Nor in the roses dressed in rain,<br>But in the hands that bear the burden,<br>And choose to shelter others' pain.<br>Love is not merely whispered softly,<br>Nor sealed within a vow of grace;<br>It lives within the quiet choices<br>That ask no witness, seek no praise.<br>And if the road should turn to sorrow,<br>And time should steal what hearts hold dear,<br>The truest love is not diminished—<br>It makes its presence stronger there.<br>For love, when freely given wholly,<br>Demands no chain, commands no claim;<br>It gives itself without possession,<br>And leaves the soul transformed by flame.<br><br>- Original poem created for reading comprehension practice.</i>",
                options: ["It shifts the reader's understanding of love from external beauty to meaningful acts of care and sacrifice.", "It suggests that material wealth is necessary for people to demonstrate affection.", "It establishes that beauty and hardship are equally valuable expressions of love.", "It implies that people who experience hardship are incapable of appreciating beauty."],
                correct: 0,
				explanation: "Correct answer is <b>It shifts the reader's understanding of love from external beauty to meaningful acts of care and sacrifice.</b>.<ul><li>Gold and roses represent external beauty or attractive symbols, while hands bearing burdens represent practical and selfless love. The contrast highlights the speaker's belief that love is defined more by actions than by appearances.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "In the line ❝Love, when freely given wholly, / Demands no chain, commands no claim,❞ what philosophical idea about love is most strongly implied?<br><br><b>The Gift of Love</b><br><br><i>Not in the gold that morning gathers,<br>Nor in the roses dressed in rain,<br>But in the hands that bear the burden,<br>And choose to shelter others' pain.<br>Love is not merely whispered softly,<br>Nor sealed within a vow of grace;<br>It lives within the quiet choices<br>That ask no witness, seek no praise.<br>And if the road should turn to sorrow,<br>And time should steal what hearts hold dear,<br>The truest love is not diminished—<br>It makes its presence stronger there.<br>For love, when freely given wholly,<br>Demands no chain, commands no claim;<br>It gives itself without possession,<br>And leaves the soul transformed by flame.<br><br>- Original poem created for reading comprehension practice.</i>",
                options: ["Love requires complete control over the person receiving it.", "Love is most genuine when it is offered without an expectation of ownership or repayment.", "Love is valuable only when the recipient promises lifelong loyalty.", "Love becomes meaningful when it creates dependence between two people."],
                correct: 1,
				explanation: "Correct answer is <b>Love is most genuine when it is offered without an expectation of ownership or repayment.</b>.<ul><li>The words ❝no chain❞ and ❝no claim❞ reject possession and control. The speaker presents love as something freely given rather than a transaction that requires ownership, obligation, or repayment.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which interpretation best explains the statement ❝The truest love is not diminished— / It makes its presence stronger there❞?<br><br><b>The Gift of Love</b><br><br><i>Not in the gold that morning gathers,<br>Nor in the roses dressed in rain,<br>But in the hands that bear the burden,<br>And choose to shelter others' pain.<br>Love is not merely whispered softly,<br>Nor sealed within a vow of grace;<br>It lives within the quiet choices<br>That ask no witness, seek no praise.<br>And if the road should turn to sorrow,<br>And time should steal what hearts hold dear,<br>The truest love is not diminished—<br>It makes its presence stronger there.<br>For love, when freely given wholly,<br>Demands no chain, commands no claim;<br>It gives itself without possession,<br>And leaves the soul transformed by flame.<br><br>- Original poem created for reading comprehension practice.</i>",
                options: ["Love always prevents people from experiencing emotional pain.", "Love becomes stronger only when people are separated permanently.", "Difficult circumstances can reveal the depth and persistence of genuine love.", "Emotional suffering is necessary for every relationship to succeed."],
                correct: 2,
				explanation: "Correct answer is <b>Difficult circumstances can reveal the depth and persistence of genuine love.</b>.<ul><li>The poem does not claim that love eliminates suffering or that hardship is always beneficial. Instead, it suggests that genuine love can become more evident through difficult circumstances because commitment and care are revealed when they are tested.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which of the following statements is NOT TRUE based on the poem?<br><br><b>The Gift of Love</b><br><br><i>Not in the gold that morning gathers,<br>Nor in the roses dressed in rain,<br>But in the hands that bear the burden,<br>And choose to shelter others' pain.<br>Love is not merely whispered softly,<br>Nor sealed within a vow of grace;<br>It lives within the quiet choices<br>That ask no witness, seek no praise.<br>And if the road should turn to sorrow,<br>And time should steal what hearts hold dear,<br>The truest love is not diminished—<br>It makes its presence stronger there.<br>For love, when freely given wholly,<br>Demands no chain, commands no claim;<br>It gives itself without possession,<br>And leaves the soul transformed by flame.<br><br>- Original poem created for reading comprehension practice.</i>",
                options: ["Love can be expressed through quiet actions that do not seek recognition.", "Genuine love does not necessarily depend on possession or control.", "Love may remain meaningful even when people encounter sorrow and loss.", "Love is genuine only when it is publicly acknowledged and rewarded by others."],
                correct: 3,
				explanation: "Correct answer is <b>Love is genuine only when it is publicly acknowledged and rewarded by others.</b>.<ul><li>The poem explicitly describes love as something that seeks no praise and demands no claim. Therefore, public recognition and rewards are not presented as requirements for genuine love.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "What is the central lesson of the passage?<br><br><b>The Farmer and the Broken Wheel</b><br><br><i>One afternoon, a farmer was returning home when he noticed a traveler struggling beside a narrow road. The traveler's cart had broken down, and several heavy sacks of grain had fallen into the mud. The farmer stopped and helped him gather the sacks, but the traveler complained that the farmer was too slow.<br><br>After repairing one of the cart's wheels, the farmer offered to help push the cart toward the nearest village. The traveler, embarrassed by his earlier behavior, apologized. However, the farmer simply smiled and continued working.<br><br>A young man who had been watching the scene asked the farmer, “Why do you help someone who treated you so poorly? Would it not be better to leave him to solve his own problem?”<br><br>The farmer replied, “If I allow another person's unkindness to determine my own actions, then I have surrendered my character to his behavior. I cannot control whether others are grateful, but I can choose whether I will act with kindness.”<br><br>The young man considered the farmer's words and asked, “Does this mean that we must help everyone, even those who repeatedly take advantage of us?”<br><br>The farmer paused before answering. “Kindness does not require foolishness. One may establish boundaries and refuse to support harmful behavior without abandoning compassion. Wisdom lies in knowing how to help without allowing resentment to govern the heart.”<br><br>As the cart finally moved along the road, the young man realized that the farmer's lesson was not simply about helping a stranger. It was about preserving one's principles while responding wisely to the actions of others.<br><br>- Original passage created for reading comprehension practice.</i>",
                options: ["People should always help others regardless of the consequences.", "Kindness is valuable only when it is rewarded with gratitude.", "A person can preserve compassion and moral integrity while exercising wisdom and personal boundaries.", "Individuals should avoid helping strangers because their behavior cannot be controlled."],
                correct: 2,
				explanation: "Correct answer is <b>A person can preserve compassion and moral integrity while exercising wisdom and personal boundaries.</b>.<ul><li>The farmer emphasizes that compassion should not depend on another person's behavior. However, he also recognizes that kindness does not require foolishness. The central lesson is to maintain one's principles while making wise decisions about helping others.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which statement best explains the farmer's response to the traveler's unkindness?<br><br><b>The Farmer and the Broken Wheel</b><br><br><i>One afternoon, a farmer was returning home when he noticed a traveler struggling beside a narrow road. The traveler's cart had broken down, and several heavy sacks of grain had fallen into the mud. The farmer stopped and helped him gather the sacks, but the traveler complained that the farmer was too slow.<br><br>After repairing one of the cart's wheels, the farmer offered to help push the cart toward the nearest village. The traveler, embarrassed by his earlier behavior, apologized. However, the farmer simply smiled and continued working.<br><br>A young man who had been watching the scene asked the farmer, “Why do you help someone who treated you so poorly? Would it not be better to leave him to solve his own problem?”<br><br>The farmer replied, “If I allow another person's unkindness to determine my own actions, then I have surrendered my character to his behavior. I cannot control whether others are grateful, but I can choose whether I will act with kindness.”<br><br>The young man considered the farmer's words and asked, “Does this mean that we must help everyone, even those who repeatedly take advantage of us?”<br><br>The farmer paused before answering. “Kindness does not require foolishness. One may establish boundaries and refuse to support harmful behavior without abandoning compassion. Wisdom lies in knowing how to help without allowing resentment to govern the heart.”<br><br>As the cart finally moved along the road, the young man realized that the farmer's lesson was not simply about helping a stranger. It was about preserving one's principles while responding wisely to the actions of others.<br><br>- Original passage created for reading comprehension practice.</i>",
                options: ["He helps the traveler because he believes mistreatment should always be ignored.", "He expects the traveler to repay his kindness through future assistance.", "He continues helping because he is unable to recognize the traveler's disrespect.", "He refuses to let another person's behavior determine his own moral choices."],
                correct: 3,
				explanation: "Correct answer is <b>He refuses to let another person's behavior determine his own moral choices.</b>.<ul><li>The farmer states that allowing unkindness to determine his actions would mean surrendering his character to someone else's behavior. His response demonstrates self-control and a commitment to acting according to his own principles.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "What important qualification does the farmer introduce when discussing compassion?<br><br><b>The Farmer and the Broken Wheel</b><br><br><i>One afternoon, a farmer was returning home when he noticed a traveler struggling beside a narrow road. The traveler's cart had broken down, and several heavy sacks of grain had fallen into the mud. The farmer stopped and helped him gather the sacks, but the traveler complained that the farmer was too slow.<br><br>After repairing one of the cart's wheels, the farmer offered to help push the cart toward the nearest village. The traveler, embarrassed by his earlier behavior, apologized. However, the farmer simply smiled and continued working.<br><br>A young man who had been watching the scene asked the farmer, “Why do you help someone who treated you so poorly? Would it not be better to leave him to solve his own problem?”<br><br>The farmer replied, “If I allow another person's unkindness to determine my own actions, then I have surrendered my character to his behavior. I cannot control whether others are grateful, but I can choose whether I will act with kindness.”<br><br>The young man considered the farmer's words and asked, “Does this mean that we must help everyone, even those who repeatedly take advantage of us?”<br><br>The farmer paused before answering. “Kindness does not require foolishness. One may establish boundaries and refuse to support harmful behavior without abandoning compassion. Wisdom lies in knowing how to help without allowing resentment to govern the heart.”<br><br>As the cart finally moved along the road, the young man realized that the farmer's lesson was not simply about helping a stranger. It was about preserving one's principles while responding wisely to the actions of others.<br><br>- Original passage created for reading comprehension practice.</i>",
                options: ["Compassion should be guided by wisdom so that helping others does not involve supporting harmful behavior.", "Individuals should refuse to help anyone who has previously behaved unkindly.", "Compassion is meaningful only when it involves personal sacrifice.", "People should never establish boundaries because doing so limits kindness."],
                correct: 0,
				explanation: "Correct answer is <b>Compassion should be guided by wisdom so that helping others does not involve supporting harmful behavior.</b>.<ul><li>The farmer explicitly states that kindness does not require foolishness. He distinguishes between maintaining compassion and allowing others to take advantage of a person. This suggests that genuine kindness can coexist with reasonable boundaries.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which situation most closely reflects the farmer's philosophy?<br><br><b>The Farmer and the Broken Wheel</b><br><br><i>One afternoon, a farmer was returning home when he noticed a traveler struggling beside a narrow road. The traveler's cart had broken down, and several heavy sacks of grain had fallen into the mud. The farmer stopped and helped him gather the sacks, but the traveler complained that the farmer was too slow.<br><br>After repairing one of the cart's wheels, the farmer offered to help push the cart toward the nearest village. The traveler, embarrassed by his earlier behavior, apologized. However, the farmer simply smiled and continued working.<br><br>A young man who had been watching the scene asked the farmer, “Why do you help someone who treated you so poorly? Would it not be better to leave him to solve his own problem?”<br><br>The farmer replied, “If I allow another person's unkindness to determine my own actions, then I have surrendered my character to his behavior. I cannot control whether others are grateful, but I can choose whether I will act with kindness.”<br><br>The young man considered the farmer's words and asked, “Does this mean that we must help everyone, even those who repeatedly take advantage of us?”<br><br>The farmer paused before answering. “Kindness does not require foolishness. One may establish boundaries and refuse to support harmful behavior without abandoning compassion. Wisdom lies in knowing how to help without allowing resentment to govern the heart.”<br><br>As the cart finally moved along the road, the young man realized that the farmer's lesson was not simply about helping a stranger. It was about preserving one's principles while responding wisely to the actions of others.<br><br>- Original passage created for reading comprehension practice.</i>",
                options: ["A student refuses to assist a classmate because the classmate previously made a rude comment.", "A student calmly refuses to participate in a dishonest activity while offering legitimate assistance to a classmate who needs help.", "A worker continues accepting unfair treatment because setting boundaries would be unkind.", "A person helps a friend only after receiving a promise of repayment."],
                correct: 1,
				explanation: "Correct answer is <b>A student calmly refuses to participate in a dishonest activity while offering legitimate assistance to a classmate who needs help.</b>.<ul><li>The student demonstrates both compassion and moral boundaries. They are willing to help in an appropriate way but refuse to support dishonesty. This reflects the farmer's belief that kindness should be guided by wisdom rather than by a complete absence of limits.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which inference is most strongly supported by the final paragraph?<br><br><b>The Farmer and the Broken Wheel</b><br><br><i>One afternoon, a farmer was returning home when he noticed a traveler struggling beside a narrow road. The traveler's cart had broken down, and several heavy sacks of grain had fallen into the mud. The farmer stopped and helped him gather the sacks, but the traveler complained that the farmer was too slow.<br><br>After repairing one of the cart's wheels, the farmer offered to help push the cart toward the nearest village. The traveler, embarrassed by his earlier behavior, apologized. However, the farmer simply smiled and continued working.<br><br>A young man who had been watching the scene asked the farmer, “Why do you help someone who treated you so poorly? Would it not be better to leave him to solve his own problem?”<br><br>The farmer replied, “If I allow another person's unkindness to determine my own actions, then I have surrendered my character to his behavior. I cannot control whether others are grateful, but I can choose whether I will act with kindness.”<br><br>The young man considered the farmer's words and asked, “Does this mean that we must help everyone, even those who repeatedly take advantage of us?”<br><br>The farmer paused before answering. “Kindness does not require foolishness. One may establish boundaries and refuse to support harmful behavior without abandoning compassion. Wisdom lies in knowing how to help without allowing resentment to govern the heart.”<br><br>As the cart finally moved along the road, the young man realized that the farmer's lesson was not simply about helping a stranger. It was about preserving one's principles while responding wisely to the actions of others.<br><br>- Original passage created for reading comprehension practice.</i>",
                options: ["The young man learns that helping others is always more important than protecting oneself.", "The farmer believes that a person's character depends entirely on how others treat them.", "The young man recognizes that moral integrity involves both compassionate intentions and wise responses to difficult situations.", "The young man concludes that resentment is necessary to prevent people from being exploited."],
                correct: 2,
				explanation: "Correct answer is <b>The young man recognizes that moral integrity involves both compassionate intentions and wise responses to difficult situations.</b>.<ul><li>The final paragraph broadens the farmer's lesson beyond the immediate act of helping a stranger. It emphasizes preserving one's principles while responding wisely to others. This supports the inference that moral integrity requires both compassion and sound judgment.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which statement best explains the functional relationship between innate and adaptive immunity?<br><br><b>The Human Immune Response</b><br><br><i>When harmful microorganisms enter the human body, the immune system activates a series of defenses to prevent infection and limit tissue damage. The first line of defense includes physical and chemical barriers, such as the skin, mucous membranes, and substances that inhibit microbial growth. When pathogens penetrate these barriers, the body's innate immune response reacts rapidly, often before the specific identity of the invading organism has been established.<br><br>White blood cells called phagocytes can engulf and destroy microorganisms through a process known as phagocytosis. During this response, damaged cells and invading pathogens may trigger inflammation, which increases blood flow and causes blood vessels to become more permeable. These changes allow immune cells and plasma proteins to reach affected tissues. Although inflammation helps eliminate harmful agents, excessive or prolonged inflammation can also injure healthy tissue.<br><br>The adaptive immune response provides a more specialized form of protection. B lymphocytes can develop into plasma cells that produce antibodies, proteins that bind to specific antigens. T lymphocytes perform several functions, including coordinating immune activity and destroying certain infected cells. Unlike many components of the innate response, adaptive immunity can generate immunological memory, allowing the body to respond more rapidly to a previously encountered pathogen.<br><br>Vaccination takes advantage of this capacity for memory. By exposing the immune system to a harmless form or component of an antigen, a vaccine can stimulate an adaptive response without requiring the person to experience the full disease. However, immune protection is not identical for every pathogen or individual, and the effectiveness of a response depends on factors such as the characteristics of the antigen and the condition of the immune system.<br><br>- Adapted from fundamental concepts in human immunology.</i>",
                options: ["Adaptive immunity prevents innate immunity from responding to pathogens.", "Innate immunity depends entirely on antibodies produced by B lymphocytes.", "Innate immunity provides an initial defense, while adaptive immunity develops a more specific response and may establish immunological memory.", "Both immune responses recognize pathogens through exactly the same mechanisms and operate at the same rate."],
                correct: 2,
				explanation: "Correct answer is <b>Innate immunity provides an initial defense, while adaptive immunity develops a more specific response and may establish immunological memory.</b>.<ul><li>Innate immunity responds rapidly through general defense mechanisms. Adaptive immunity provides more specialized protection involving B and T lymphocytes and can generate memory, which supports faster responses to previously encountered pathogens.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "A patient experiences prolonged inflammation after an infection has largely been eliminated. Which conclusion is most consistent with the passage?<br><br><b>The Human Immune Response</b><br><br><i>When harmful microorganisms enter the human body, the immune system activates a series of defenses to prevent infection and limit tissue damage. The first line of defense includes physical and chemical barriers, such as the skin, mucous membranes, and substances that inhibit microbial growth. When pathogens penetrate these barriers, the body's innate immune response reacts rapidly, often before the specific identity of the invading organism has been established.<br><br>White blood cells called phagocytes can engulf and destroy microorganisms through a process known as phagocytosis. During this response, damaged cells and invading pathogens may trigger inflammation, which increases blood flow and causes blood vessels to become more permeable. These changes allow immune cells and plasma proteins to reach affected tissues. Although inflammation helps eliminate harmful agents, excessive or prolonged inflammation can also injure healthy tissue.<br><br>The adaptive immune response provides a more specialized form of protection. B lymphocytes can develop into plasma cells that produce antibodies, proteins that bind to specific antigens. T lymphocytes perform several functions, including coordinating immune activity and destroying certain infected cells. Unlike many components of the innate response, adaptive immunity can generate immunological memory, allowing the body to respond more rapidly to a previously encountered pathogen.<br><br>Vaccination takes advantage of this capacity for memory. By exposing the immune system to a harmless form or component of an antigen, a vaccine can stimulate an adaptive response without requiring the person to experience the full disease. However, immune protection is not identical for every pathogen or individual, and the effectiveness of a response depends on factors such as the characteristics of the antigen and the condition of the immune system.<br><br>- Adapted from fundamental concepts in human immunology.</i>",
                options: ["Prolonged inflammation must always improve the body's ability to eliminate pathogens.", "Inflammation is harmful because it prevents immune cells from reaching damaged tissues.", "The immune system has permanently lost its ability to distinguish between healthy and infected cells.", "Although inflammation supports defense and tissue protection, its continued activity may cause damage to healthy tissues."],
                correct: 3,
				explanation: "Correct answer is <b>Although inflammation supports defense and tissue protection, its continued activity may cause damage to healthy tissues.</b>.<ul><li>Inflammation increases blood flow and vascular permeability, helping immune components reach affected areas. However, the passage explicitly states that excessive or prolonged inflammation can injure healthy tissue.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Why does vaccination generally aim to stimulate adaptive immunity rather than simply increase inflammation?<br><br><b>The Human Immune Response</b><br><br><i>When harmful microorganisms enter the human body, the immune system activates a series of defenses to prevent infection and limit tissue damage. The first line of defense includes physical and chemical barriers, such as the skin, mucous membranes, and substances that inhibit microbial growth. When pathogens penetrate these barriers, the body's innate immune response reacts rapidly, often before the specific identity of the invading organism has been established.<br><br>White blood cells called phagocytes can engulf and destroy microorganisms through a process known as phagocytosis. During this response, damaged cells and invading pathogens may trigger inflammation, which increases blood flow and causes blood vessels to become more permeable. These changes allow immune cells and plasma proteins to reach affected tissues. Although inflammation helps eliminate harmful agents, excessive or prolonged inflammation can also injure healthy tissue.<br><br>The adaptive immune response provides a more specialized form of protection. B lymphocytes can develop into plasma cells that produce antibodies, proteins that bind to specific antigens. T lymphocytes perform several functions, including coordinating immune activity and destroying certain infected cells. Unlike many components of the innate response, adaptive immunity can generate immunological memory, allowing the body to respond more rapidly to a previously encountered pathogen.<br><br>Vaccination takes advantage of this capacity for memory. By exposing the immune system to a harmless form or component of an antigen, a vaccine can stimulate an adaptive response without requiring the person to experience the full disease. However, immune protection is not identical for every pathogen or individual, and the effectiveness of a response depends on factors such as the characteristics of the antigen and the condition of the immune system.<br><br>- Adapted from fundamental concepts in human immunology.</i>",
                options: ["Inflammation is unrelated to the body's defense against pathogens.", "Adaptive immunity can produce antigen-specific responses and immunological memory, potentially improving protection during later exposure.", "Adaptive immunity eliminates the need for all physical and chemical barriers.", "Vaccination works by permanently preventing all microorganisms from entering the body."],
                correct: 1,
				explanation: "Correct answer is <b>Adaptive immunity can produce antigen-specific responses and immunological memory, potentially improving protection during later exposure.</b>.<ul><li>Vaccination introduces a harmless form or component of an antigen to stimulate an adaptive immune response. The resulting memory can support a faster response when the immune system encounters the relevant pathogen again.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "A researcher discovers that an individual produces antibodies against a particular pathogen but has impaired phagocyte activity. Which inference is most strongly supported by the passage?<br><br><b>The Human Immune Response</b><br><br><i>When harmful microorganisms enter the human body, the immune system activates a series of defenses to prevent infection and limit tissue damage. The first line of defense includes physical and chemical barriers, such as the skin, mucous membranes, and substances that inhibit microbial growth. When pathogens penetrate these barriers, the body's innate immune response reacts rapidly, often before the specific identity of the invading organism has been established.<br><br>White blood cells called phagocytes can engulf and destroy microorganisms through a process known as phagocytosis. During this response, damaged cells and invading pathogens may trigger inflammation, which increases blood flow and causes blood vessels to become more permeable. These changes allow immune cells and plasma proteins to reach affected tissues. Although inflammation helps eliminate harmful agents, excessive or prolonged inflammation can also injure healthy tissue.<br><br>The adaptive immune response provides a more specialized form of protection. B lymphocytes can develop into plasma cells that produce antibodies, proteins that bind to specific antigens. T lymphocytes perform several functions, including coordinating immune activity and destroying certain infected cells. Unlike many components of the innate response, adaptive immunity can generate immunological memory, allowing the body to respond more rapidly to a previously encountered pathogen.<br><br>Vaccination takes advantage of this capacity for memory. By exposing the immune system to a harmless form or component of an antigen, a vaccine can stimulate an adaptive response without requiring the person to experience the full disease. However, immune protection is not identical for every pathogen or individual, and the effectiveness of a response depends on factors such as the characteristics of the antigen and the condition of the immune system.<br><br>- Adapted from fundamental concepts in human immunology.</i>",
                options: ["The individual may retain some antigen-specific immune function while experiencing impaired aspects of the initial cellular defense.", "The individual cannot develop any immune response because antibodies and phagocytes perform identical functions.", "The individual's innate immunity must be fully functional because antibodies are present.", "Antibody production guarantees complete protection against all future infections."],
                correct: 0,
				explanation: "Correct answer is <b>The individual may retain some antigen-specific immune function while experiencing impaired aspects of the initial cellular defense.</b>.<ul><li>Phagocytes participate in innate immunity by engulfing and destroying microorganisms, while antibodies are produced by plasma cells derived from B lymphocytes. Impairment of one component does not necessarily eliminate all other immune functions, although the overall immune response may be affected.</li></ul>"
            },
			{
                subject: "English",
                subtopic: "Reading Comprehension",
                sidebarId: "side-eng-read",
                directions: "Read each selection then answer the questions. Choose the letter that corresponds to the correct answer based on the given selections.",
                question: "Which statement would most directly challenge the explanation of immunological memory presented in the passage?<br><br><b>The Human Immune Response</b><br><br><i>When harmful microorganisms enter the human body, the immune system activates a series of defenses to prevent infection and limit tissue damage. The first line of defense includes physical and chemical barriers, such as the skin, mucous membranes, and substances that inhibit microbial growth. When pathogens penetrate these barriers, the body's innate immune response reacts rapidly, often before the specific identity of the invading organism has been established.<br><br>White blood cells called phagocytes can engulf and destroy microorganisms through a process known as phagocytosis. During this response, damaged cells and invading pathogens may trigger inflammation, which increases blood flow and causes blood vessels to become more permeable. These changes allow immune cells and plasma proteins to reach affected tissues. Although inflammation helps eliminate harmful agents, excessive or prolonged inflammation can also injure healthy tissue.<br><br>The adaptive immune response provides a more specialized form of protection. B lymphocytes can develop into plasma cells that produce antibodies, proteins that bind to specific antigens. T lymphocytes perform several functions, including coordinating immune activity and destroying certain infected cells. Unlike many components of the innate response, adaptive immunity can generate immunological memory, allowing the body to respond more rapidly to a previously encountered pathogen.<br><br>Vaccination takes advantage of this capacity for memory. By exposing the immune system to a harmless form or component of an antigen, a vaccine can stimulate an adaptive response without requiring the person to experience the full disease. However, immune protection is not identical for every pathogen or individual, and the effectiveness of a response depends on factors such as the characteristics of the antigen and the condition of the immune system.<br><br>- Adapted from fundamental concepts in human immunology.</i>",
                options: ["Vaccination can stimulate immune responses without requiring a person to experience the full disease.", "Exposure to an antigen can never influence the speed or effectiveness of a later immune response to that same antigen.", "Adaptive immunity can involve both B lymphocytes and T lymphocytes.", "The immune system can respond to specific antigens through specialized mechanisms."],
                correct: 1,
				explanation: "Correct answer is <b>Exposure to an antigen can never influence the speed or effectiveness of a later immune response to that same antigen.</b>.<ul><li>The passage states that adaptive immunity can generate immunological memory, allowing a more rapid response to a previously encountered pathogen. The claim that prior exposure can never affect a later response directly contradicts this principle.</li></ul>"
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Siya ay may turing na <i>alimpapaw</i> kaya't marami ang naiinis sa kanyang asal.",
                options: ["mababa ang loob", "mayabang", "matulungin", "mahiyain"],
                correct: 1,
				explanation: "Ang <b>alimpapaw</b> ay nangangahulugang <i>mataas ang lipad o tingin sa sarili</i>."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Ang aming lumang bahay ay muling inayos ng isang mahusay na <i>anluwagi</i>.",
                options: ["guro", "bumbero", "karpintero", "magsasaka"],
                correct: 2,
		explanation: "Ang <b>anluwagi</b> ay ang katutubong salita para sa mga nagpapatayo at nagkukumpuni ng mga estrukturang kahoy."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Isang magandang <i>binibini</i> ang dumating sa pagtitipon kagabi.",
                options: ["matandang lalaki", "dalaga", "sanggol", "binata"],
                correct: 1,
		explanation: "Ang <b>binibini</b> ay tradisyunal na tawag sa isang babaeng wala pang asawa."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Nagbigay-pugay ang magiting na <i>ginoo</i> sa mga panauhin.",
                options: ["lalaki", "magnanakaw", "katulong", "bata"],
                correct: 0,
		explanation: "Ang <i>ginoo</i> ay isang magalang na katawagan na ginagamit para sa isang lalaki."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Ang <i>katalonan</i> ay nanalangin para sa masaganang ani ng tribo.",
                options: ["sundalo", "pariwang babae o babaylan", "mangangalakal", "alipin"],
                correct: 1,
		explanation: "Ang <i>katalonan</i> ay sinaunang katawagan sa pinunong espirituwal, manggagamot, o pari ng tribo sa katagalugan bago dumating ang mga Espanyol."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Matagal nang naghihintay ang kanyang <i>katipan</i> sa tabing-dagat.",
                options: ["kaaway", "kasintahan", "kapatid", "guro"],
                correct: 1,
		explanation: "Ang <b>katipan</b> ay tumutukoy sa taong pinangakuang pakasalan o seryosong kabiyak ng puso."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Si Maria Clara ang itinuturing na <i>lakambini</i> ng kanilang bayan.",
                options: ["mutya o diwata", "katulong", "pinsan", "manggagamot"],
                correct: 0,
		explanation: "Ang <b>lakambini</i> ay ang reyna, pangunahing babae, muse, o natatanging mutya ng isang pangkat."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Pinamunuan ng isang matapang na <i>lakan</i> ang sinaunang barangay.",
                options: ["mamamayan", "pinuno or maharlika", "banyaga", "alipin"],
                correct: 1,
		explanation: "Ang <b>lakan</b> ay isang pamagat o titulo na ibinibigay sa mga sinaunang pinuno o dugong-bughaw na lalaki."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Hinangaan ng lahat ang kanyang <i>maginoo</i> na pagkilos.",
                options: ["marangal", "bastos", "matatakutin", "madamot"],
                correct: 0,
		explanation: "Ang <b>maginoo</b> ay nagpapakita ng katangian ng isang taong may mataas na dangal, respeto, at mabuting asal."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Ipinangako niya ang walang wakas na pag-ibig sa kanyang <i>sinta</i>.",
                options: ["kaibigan", "minamahal", "kaaway", "kaklase"],
                correct: 1,
		explanation: "Ang <b>sinta</b> ay isang malambing at lumang katawagan para sa kasintahan o giliw."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Nadama niya ang <i>alon-alon</i> sa dibdib habang naghihintay ng resulta.",
                options: ["kaligayahan", "kaba o balisa", "katapangan", "antok"],
                correct: 1,
		explanation: "Ang <b>alon-alon</i> ay talinghaga na naglalarawan sa pabago-bago at mabilis na pintig ng dibdib dahil sa labis na pag-aalala."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Tila nakita ko ang iyong mukha sa aking <i>balintataw</i>.",
                options: ["guniguni o paningin", "panaginip", "salamin", "pangarap"],
                correct: 0,
		explanation: "Ang <b>balintataw</b> ay pisikal na tumutukoy sa pupil ng mata, ngunit sa panitikan ay ginagamit ito para sa imahinasyon o sa <i>isip</i>."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "May nakita siyang kaunting <i>banaag</i> ng pag-asa sa kabila ng hirap.",
                options: ["dilim", "aninag o sinag", "ulap", "tunog"],
                correct: 1,
		explanation: "Ang <b>banaag</b> ay bahagyang liwanag, sinag, o kaunting bakas na nagbibigay ng pahiwatig."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Ang mga nakakatakot na kwento ay lumikha ng masamang <i>guniguni</i> sa bata.",
                options: ["imahinasyon", "alaala", "katotohanan", "aral"],
                correct: 0,
		explanation: "Ang <b>guniguni</b> ay ang paglikha ng mga haka-haka o larawan sa isip na madalas ay walang katotohanan."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "May <i>hinagap</i> akong darating ka ngayong gabi.",
                options: ["takot", "kutob o akala", "utang", "balita"],
                correct: 1,
		explanation: "Ang <b>hinagap</b> ay panloob na pakiramdam, hinala, o ideya sa isang bagay na maaaring mangyari."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Ang kanyang <i>hinuha</i> ay napatunayang tama pagkatapos ng imbestigasyon.",
                options: ["konklusyon o palagay", "tanong", "laro", "tula"],
                correct: 0,
		explanation: "Ang <b>hinuha</b> ay isang matalinong hula o palagay batay sa mga nakakalap na ebidensya o senyales."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Labis na <i>lumbay</i> ang naramdaman niya sa pag-alis ng kanyang mga magulang.",
                options: ["galit", "tuwa", "lungkot", "gulat"],
                correct: 2,
		explanation: "Ang <b>lumbay<</b> ay malalim na damdamin ng kapanglawan, kalungkutan, o pagdadalamhati."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Isang <i>marilag</i> na tanawin ang sumalubong sa amin sa tuktok ng bundok.",
                options: ["pangit", "maganda", "madilim", "maingay"],
                correct: 1,
		explanation: "Ang <b>marilag</b> ay ginagamit upang ilarawan ang isang tao o bagay na may angking labis na kagandahan o kaningningan."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Puno ng <i>pighati</i> ang puso ng ina sa pagkawala ng kanyang anak.",
                options: ["kagalakan", "dalamhati o dusa", "galit", "pag-asa"],
                correct: 1,
		explanation: "Ang <b>pighati</b> ay matinding sakit ng kalooban, pagdurusa, o mabigat na pampunong emosyon dahil sa trahedya."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Bago pa mangyari ang sakuna, may <i>salagimsim</i> na siyang nararamdaman.",
                options: ["masamang kutob", "magandang balita", "panaginip", "lagnat"],
                correct: 0,
		explanation: "Ang <b>salagimsim</b> ay isang uri ng kutob kung saan nararamdaman ng isang tao na may mangyayaring hindi maganda."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Ang labis na <i>siphayo</i> ay nagdulot sa kanya ng kawalan ng pag-asa.",
                options: ["kabiguan o pagkadusta", "tagumpay", "yaman", "dunong"],
                correct: 0,
		explanation: "Ang <b>siphayo</b> ay ang estado ng pagiging api, bigo, o matinding nadaya sa mga pangarap sa buhay."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Tumingala siya sa malawak na <i>alapaap</i> upang magdasal.",
                options: ["lupa", "dagat", "himpapawid o ulap", "gubat"],
                correct: 2,
		explanation: "Ang <b>alapaap</b> ay tumutukoy sa malawak na kalangitan o kumpol ng mga ulap sa himpapawid."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Gawa sa <i>asoge</i> ang likido sa loob ng lumang termometro.",
                options: ["ginto", "merkyuri", "pilak", "tanso"],
                correct: 1,
		explanation: "Ang <b>asoge</b> ay ang katutubong salita para sa <i>mercury</i>, ang natatanging likidong metal na kulay pilak."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Mabilis na ibinukad ng ibon ang kanyang <i>bagwis</i> upang lumipad.",
                options: ["pakpak", "tuka", "paa", "buntot"],
                correct: 0,
		explanation: "Ang <b>bagwis</b> ay ang bahagi ng katawan ng ibon o kulisap na ginagamit nito sa paglipad."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Naglalakad sila sa tabing-daan tuwing sumasapit ang <i>dapit-hapon</i>.",
                options: ["umaga", "tanghali", "takipsilim", "hatinggabi"],
                correct: 2,
		explanation: "Ang <b>dapit-hapon</b> ay ang oras o yugto ng araw kung kailan papalubog na ang sikat ng araw."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Isang matalim na <i>dagiti</i> ang gumuhit sa madilim na langit.",
                options: ["kidlat o baha ng liwanag", "ulan", "hangin", "kulog"],
                correct: 0,
		explanation: "Ang <b>dagiti</b> ay tumutukoy sa biglang talsik, talim, o matinding guhit ng liwanag tulad ng kidlat."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Narinig ng buong bayan ang malakas na <i>dagundong</i> ng bulkan.",
                options: ["bulong", "humihiyaw na tunog o ugong", "iyak", "awit"],
                correct: 1,
		explanation: "Ang <b>dagundong</b> ay malalim, mababa, ngunit nakatutulig na ugong na nagmumula sa malayo o sa ilalim ng lupa."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Masarap maglakad sa <i>dalampasigan</i> kapag malamig ang simoy ng hangin.",
                options: ["tabing-dagat", "kabundukan", "lungsod", "kapatagan"],
                correct: 0,
		explanation: "Ang <b>dalampasigan</b> ay ang mabuhangin o mabatong bahagi ng lupa na nakaharap at katabi mismo ng dagat."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Nagliwanag ang paligid dahil sa ganda ng <i>kabuwanan</i>.",
                options: ["kabilugan ng buwan", "sikat ng araw", "bituin", "ambon"],
                correct: 0,
		explanation: "Ang <b>kabuwanan</b> ay ginagamit upang ilarawan ang gabi kung kailan buo, bilog, at maliwanag ang mukha ng buwan."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Ang pagsikat ng <i>sikatuna</i> ang hudyat ng bagong umaga.",
                options: ["madaling-araw o pagsikat ng araw", "gabi", "ulan", "bagyo"],
                correct: 0,
		explanation: "Ang <b>sikatuna</b> ay tumutukoy sa unang sikat ng araw o ang liwanag ng bukang-liwayway."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Hindi niya napigilan ang <i>silakbo</i> ng kanyang damdamin.",
                options: ["biglang buhos o pagsabog", "pananahimik", "pagtulog", "paglimot"],
                correct: 0,
		explanation: "Ang <b>silakbo</b> ay ang pabigla-bigla at matinding pagbuhos ng emosyon, galit, o lakas ng kalikasan."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Ang lumilipad na <i>alipato</i> mula sa siga ay delikado sa mga tuyong dahon.",
                options: ["talsik ng apoy", "abo", "usok", "uling"],
                correct: 0,
		explanation: "Ang <b>alipato</b> ay ang maliliit at nagniningas na baga o talsik ng apoy na lumilipad mula sa isang malaking sunog."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Gumamit siya ng gamot para mawala ang <i>alipunga</i> sa kanyang paa.",
                options: ["sugat", "hadhad o alipunga (fungal infection)", "pigsa", "pasa"],
                correct: 1,
		explanation: "Ang <b>alipunga</b> ay isang uri ng makating sakit sa balat, partikular sa pagitan ng mga daliri sa paa, na sanhi ng mikrobyo o fungi (athlete's foot)."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Ipinagbawal ng pamahalaan ang pagbebenta ng mapanganib na <i>apyan</i>.",
                options: ["alak", "opyo", "sigarilyo", "kape"],
                correct: 1,
		explanation: "Ang <b>apyan</b> ay lumang katutubong katawagan para sa <i>opium</i>, isang uri ng nakakahumaling na halaman o droga."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Naghugas ng mga kamay ang lola sa lumang <i>batalan</i>.",
                options: ["kusina", "paminggalan o balkonahe sa likod ng bahay", "sala", "silid"],
                correct: 1,
		explanation: "Ang <b>batalan</b> ay ang bahagi ng lumang bahay-kubo na matatagpuan sa likod, kadalasang walang bubong, at nagsisilbing ligawan o hugasan."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Nakatira ang matanda sa isang simpleng <i>dampa</i> sa gitna ng bukid.",
                options: ["mansiyon", "kubo", "gusali", "apartment"],
                correct: 1,
		explanation: "Ang <b>dampa</b> ay tumutukoy sa isang maliit, payak, at mababang uri ng bahay o kubo."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Sumunod ka sa index ko at lumingon sa <i>durungawan</i>.",
                options: ["pintuan", "bintana", "bubong", "sahig"],
                correct: 1,
		explanation: "Ang <b>durungawan</b> ay nagmula sa salitang <i>dungaw</i> at nangangahulugang bintana."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Huwag mong <i>ipuring</i> ang maruming kamay mo sa malinis na pader.",
                options: ["iwanan", "meron o pahiran ng uling", "linisin", "pinturahan"],
                correct: 1,
		explanation: "Ang <b>ipuring</b> ay ang kilos ng pagpápahid o pagpapadungis gamit ang uling, agiw, o ulong."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Nagtago ang mga bata sa isang <i>kubli</i> na lugar.",
                options: ["bukas", "tago o ligtas", "maingay", "mataas"],
                correct: 1,
		explanation: "Ang <b>kubli</b> ay naglalarawan sa isang lugar o bagay na nakatago at protektado sa paningin o panganib."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Itinabi ni nanay ang mga platong malinis sa loob ng <i>paminggalan</i>.",
                options: ["kabinet", "higaan", "banyo", "baul"],
                correct: 0,
		explanation: "Ang <b>paminggalan</b> ay ang tradisyunal na kabinet, estante, o aparador sa kusina kung saan pinatutuyo at itinatago ang mga pinggan at baso."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Ang mabilis na <i>salipawpaw</i> ay dumaan sa ibabaw ng aming bahay.",
                options: ["bapor", "eroplano", "tren", "kotse"],
                correct: 1,
		explanation: "Ang <b>salipawpaw</b> ay isang lumang likhang-salita noong unang panahon na nangangahulugang eroplano."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Taglay ng dalaga ang isang angking <i>alindog</i> na nakakabighani.",
                options: ["kagandahan", "kahusayan", "kabaitan", "kahinhinan"],
                correct: 0,
		explanation: "Ang <b>alindog</b> ay tumutukoy sa natatangi at matinding ganda o kariktan na umaakit sa paningin ng iba."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "May nakasukbit na matalim na <i>balaraw</i> sa kanyang baywang.",
                options: ["baril", "kutsilyo", "pana", "espada"],
                correct: 1,
		explanation: "Ang <b>balaraw</b> ay isang uri ng sinaunang maikling patalim o kutsilyo na may matalas na dulo (dagger)."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Itinuturing na isang <i>banyaga</i> ang turistang kapapasok pa lamang sa nayon.",
                options: ["kamag-anak", "dayuhan", "kaibigan", "pinuno"],
                correct: 1,
		explanation: "Ang <b>banyaga</i> ay isang tao o kulturang nagmula sa ibang lupain o bansa."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Ginamit ng mandirigma ang kanyang <i>kalasag</i> laban sa mga palaso.",
                options: ["panangga", "espada", "sibat", "helmet"],
                correct: 0,
		explanation: "Ang <b>kalasag</b> ay ang tradisyunal na panangga na hinahawakan ng mga sinaunang kawal upang harangan ang pag-atake ng kaaway."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Ang matinding <i>panibugho</i> ay sumira sa kanilang relasyon.",
                options: ["pagseselos", "pagtitiwala", "paggalang", "kagalakan"],
                correct: 0,
		explanation: "Ang <b>panibugho</b> ay ang malalim at masakit na damdamin ng pagseselos sa mahal sa buhay."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "<i>Napariwara</i> ang buhay ng binatang sumama sa masamang barkada.",
                options: ["napasama", "umunlad", "sumikat", "napabuti"],
                correct: 0,
		explanation: "Ang <b>napariwara</b> ay nangangahulugang napasama, nalihis ng landas, o nasira ang magandang kinabukasan."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Ang kanyang <i>sikhay</i> sa pag-aaral ang nagdala sa kanya sa tagumpay.",
                options: ["katamaran", "sigasig", "swerte", "yaman"],
                correct: 1,
		explanation: "Ang <b>sikhay</b> ay tumutukoy sa puspusang paggugol ng lakas, tiyaga, at masigasig na pagsisikap sa isang layunin."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Huwag kang magtitiwala sa isang taong <i>sukab</i>.",
                options: ["tapat", "taksil", "mabait", "matulungin"],
                correct: 1,
		explanation: "Ang <b>sukab</b> ay naglalarawan sa isang taong mapanlinlang, taksil, at hindi marunong tumanaw ng katapatan."
            },
			{
                subject: "Filipino",
                subtopic: "Kasingkahulugan",
                sidebarId: "side-fil-kasin",
                directions: "Piliin ang salitang kasingkahulugan ng salitang nakapahilig.",
                question: "Pinarusahan ng batas ang <i>tampalasan</i> na nagnakaw sa simbahan.",
                options: ["bayani", "bastos", "di nagbabayad ng utang", "tsismosa"],
                correct: 1,
		explanation: "Ang <b>tampalasan</b> ay tumutukoy sa isang taong masama, bastos, walang galang, o gumagawa ng masasamang krimen sa kapwa."
            },
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang kaniyang puso ay napuno ng <i>pighati</i> nang mawala ang kaniyang minamahal.",
			    options: ["dalamhati", "lumbay", "hinagpis", "galak"],
			    correct: 3,
			    explanation: "Ang <b>pighati</b> ay matinding kalungkutan o dalamhati. Ang <b>galak</b> ay matinding kagalakan, kaya ito ang kasalungat."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Hindi siya natinag sa kabila ng matinding <i>siphayo</i>.",
			    options: ["pag-asa", "kabiguan", "dalamhati", "pangamba"],
			    correct: 0,
			    explanation: "Ang <b>siphayo</b> ay pagkabigo o kawalan ng pag-asa. Ang <b>pag-asa</b> ay paniniwalang may mabuting maaaring mangyari."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang binata ay <i>bantulot</i> na tanggapin ang alok.",
			    options: ["nag-aatubili", "nag-aalinlangan", "malugod", "nag-uurong-sulong"],
			    correct: 2,
			    explanation: "Ang <b>bantulot</b> ay nag-aatubili o nag-aalinlangan. Ang <b>malugod</b> ay kusang-loob at masayang pagtanggap."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "<i>Tahas</i> ang kaniyang pagsasalita at wala siyang itinatago.",
			    options: ["tuwiran", "maligoy", "lantad", "hayag"],
			    correct: 1,
			    explanation: "Ang <b>tahas</b> ay tuwiran at walang pagkukunwari. Ang <b>maligoy</b> ay paikot-ikot at hindi tuwiran."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Sa gitna ng kaguluhan ay nanatili siyang <i>matiwasay</i>.",
			    options: ["payapa", "panatag", "tahimik", "balisa"],
			    correct: 3,
			    explanation: "Ang <b>matiwasay</b> ay payapa at walang pagkabalisa. Ang <b>balisa</b> ay hindi mapalagay at puno ng pag-aalala."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "<i>Marubdob</i> ang kaniyang pagmamahal sa kaniyang bayan.",
			    options: ["taimtim", "masidhi", "matamlay", "maalab"],
			    correct: 2,
			    explanation: "Ang <b>marubdob</b> ay matindi o masidhi. Ang <b>matamlay</b> ay walang sigla o sigasig."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang kaniyang hangarin ay <i>wagas</i> at walang halong pansariling interes.",
			    options: ["dalisay", "taimtim", "marumi", "tapat"],
			    correct: 2,
			    explanation: "Ang <b>wagas</b> ay dalisay, malinis, at walang halo. Ang <b>marumi</b> ay salungat sa diwa ng kalinisan o kadalisayan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "<i>Salat</i> sa pagkain ang pamilya bago sila natulungan.",
			    options: ["kapos", "masagana", "dukha", "salat"],
			    correct: 1,
			    explanation: "Ang <b>salat</b> ay kulang o kapos. Ang <b>masagana</b> ay sagana o higit sa sapat."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang dating <i>dukha</i> ay naging matagumpay na mangangalakal.",
			    options: ["kapos", "salat", "maralita", "mayaman"],
			    correct: 3,
			    explanation: "Ang <b>dukha</b> ay mahirap o salat sa materyal na yaman. Ang <b>mayaman</b> ay kabaligtaran nito."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Siya ay isang <i>pantas</i> na kinikilala sa buong lalawigan.",
			    options: ["mangmang", "marunong", "maalam", "dalubhasa"],
			    correct: 0,
			    explanation: "Ang <b>pantas</b> ay taong may malawak na kaalaman at karunungan. Ang <b>mangmang</b> ay taong salat sa kaalaman."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Itinuturing siyang <i>uliran</i> ng mga kabataan.",
			    options: ["huwaran", "halimbawa", "masamang halimbawa", "modelo"],
			    correct: 2,
			    explanation: "Ang <b>uliran</b> ay huwaran o taong karapat-dapat tularan. Ang <b>masamang halimbawa</b> ay kabaligtaran ng huwaran."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "<i>Buktot</i> ang kaniyang pagkatao kaya marami ang umiiwas sa kaniya.",
			    options: ["masama", "mabuti", "salbahe", "balakyot"],
			    correct: 1,
			    explanation: "Ang <b>buktot</b> ay masama ang asal o pagkatao. Ang <b>mabuti</b> ay kabaligtaran nito."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Kilala ang pinuno bilang isang <i>lilo</i> na mapagkunwari.",
			    options: ["tuso", "mapanlinlang", "tapat", "taksil"],
			    correct: 2,
			    explanation: "Ang <b>lilo</b> ay tuso o mapanlinlang. Ang <b>tapat</b> ay hindi nanlilinlang."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Tinawag siyang <i>tampalasan</i> dahil wala siyang galang sa matatanda.",
			    options: ["walang-hiya", "bastos", "walang-pakundangan", "magalang"],
			    correct: 3,
			    explanation: "Ang <b>tampalasan</b> ay taong walang galang o pakundangan. Ang <b>magalang</b> ay nagpapakita ng paggalang."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang <i>salanggapang</i> ay nahuli matapos paulit-ulit na manlinlang.",
			    options: ["matapat", "manlilinlang", "tuso", "mandaraya"],
			    correct: 0,
			    explanation: "Ang <b>salanggapang</b> ay taong mapanlinlang o gumagawa ng masama. Ang <b>matapat</b> ay tapat at hindi nanlilinlang."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Hindi niya matiis ang <i>poot</i> na kaniyang nararamdaman.",
			    options: ["muhi", "galit", "pagkamuhi", "pagmamahal"],
			    correct: 3,
			    explanation: "Ang <b>poot</b> ay matinding galit o pagkamuhi. Ang <b>pagmamahal</b> ay kabaligtaran ng matinding pagkamuhi."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang kaniyang <i>muhi</i> sa kapwa ay unti-unting napalitan ng awa.",
			    options: ["galit", "pagkamuhi", "pag-ibig", "poot"],
			    correct: 2,
			    explanation: "Ang <b>muhi</b> ay matinding pagkamuhi o galit. Ang <b>pag-ibig</b> ay matinding pagmamahal."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Narinig ang kaniyang <i>panaghoy</i> mula sa kabilang silid.",
			    options: ["daing", "halakhak", "pag-iyak", "paghihinagpis"],
			    correct: 1,
			    explanation: "Ang <b>panaghoy</b> ay malungkot na pag-iyak o pagdaing. Ang <b>halakhak</b> ay malakas at masayang pagtawa."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Hindi maipaliwanag ang kaniyang <i>hinagpis</i> matapos ang trahedya.",
			    options: ["dalamhati", "pighati", "lumbay", "kagalakan"],
			    correct: 3,
			    explanation: "Ang <b>hinagpis</b> ay matinding lungkot o dalamhati. Ang <b>kagalakan</b> ay matinding saya."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Bumigat ang kaniyang <i>lumbay</i> habang lumilipas ang mga araw.",
			    options: ["ligaya", "kalungkutan", "pighati", "dalamhati"],
			    correct: 0,
			    explanation: "Ang <b>lumbay</b> ay kalungkutan o dalamhati. Ang <b>ligaya</b> ay malaking saya o kagalakan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang mga kawal ay nakaranas ng matinding <i>dusa</i> sa digmaan.",
			    options: ["hirap", "pagdurusa", "ginhawa", "sakit"],
			    correct: 2,
			    explanation: "Ang <b>dusa</b> ay matinding paghihirap. Ang <b>ginhawa</b> ay kaginhawahan o kawalan ng hirap."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang balita ay nagdulot ng <i>hilakbot</i> sa mga tagaroon.",
			    options: ["takot", "sindak", "pangamba", "kapanatagan"],
			    correct: 3,
			    explanation: "Ang <b>hilakbot</b> ay matinding takot o sindak. Ang <b>kapanatagan</b> ay kalagayan ng pagiging panatag at walang takot."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Hindi niya maalis ang <i>pangamba</i> sa kaniyang kalooban.",
			    options: ["takot", "kapanatagan", "pag-aalala", "pagkabalisa"],
			    correct: 1,
			    explanation: "Ang <b>pangamba</b> ay takot o pag-aalala tungkol sa maaaring mangyari. Ang <b>kapanatagan</b> ay kawalan ng pangamba."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Nakaramdam siya ng <i>dagok</i> nang biglang mawalan ng trabaho.",
			    options: ["pagsubok", "kabiguan", "biyaya", "suliranin"],
			    correct: 2,
			    explanation: "Ang <b>dagok</b> ay mabigat na pagsubok o masamang pangyayaring tumatama sa isang tao. Ang <b>biyaya</b> ay pagpapala o mabuting natatanggap."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "<i>Salimuot</i> ang naging usapin dahil sa magkakasalungat na pahayag.",
			    options: ["kasimplehan", "kaguluhan", "komplikasyon", "kalituhan"],
			    correct: 0,
			    explanation: "Ang <b>salimuot</b> ay pagiging masalimuot, magulo, o mahirap unawain. Ang <b>kasimplehan</b> ay kawalan ng komplikasyon."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Matagal siyang nagkaroon ng <i>gunam-gunam</i> tungkol sa kaniyang naging pasya.",
			    options: ["pagbubulay-bulay", "pagninilay", "malalim na pag-iisip", "pagwawalang-bahala"],
			    correct: 3,
			    explanation: "Ang <b>gunam-gunam</b> ay malalim na pag-iisip o pagbubulay-bulay. Ang <b>pagwawalang-bahala</b> ay hindi pagbibigay-pansin."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang kaniyang <i>adhika</i> ay makapaglingkod sa mga mahihirap.",
			    options: ["hangarin", "pag-ayaw", "mithiin", "layunin"],
			    correct: 1,
			    explanation: "Ang <b>adhika</b> ay hangarin o mithiin. Ang <b>pag-ayaw</b> ay kawalan ng hangaring gawin o tanggapin ang isang bagay."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang kaniyang <i>bighani</i> ay hindi maikubli sa harap ng maraming tao.",
			    options: ["pagkamuhi", "pang-akit", "gayuma", "pagkaakit"],
			    correct: 0,
			    explanation: "Ang <b>bighani</b> ay matinding pang-akit o kagandahang nakaaakit. Ang <b>pagkamuhi</b> ay matinding pag-ayaw o galit."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang kaniyang tinig ay may <i>balani</i> na pumukaw sa damdamin ng mga nakikinig.",
			    options: ["pang-akit", "gayuma", "pagtaboy", "halina"],
			    correct: 2,
			    explanation: "Ang <b>balani</b> ay kaakit-akit na puwersa o bagay na humihikayat. Ang <b>pagtaboy</b> ay pagpapalayo o pagtulak palayo."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Si Maria ang <i>mutya</i> ng kaniyang mga magulang.",
			    options: ["minamahal", "pinakamamahal", "iniingatan", "kinamumuhian"],
			    correct: 3,
			    explanation: "Ang <b>mutya</b> ay taong pinakamamahal o itinuturing na napakahalaga. Ang <b>kinamumuhian</b> ay taong kinasusuklaman."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang ina ay <i>mapagkandili</i> sa kaniyang mga anak.",
			    options: ["maalaga", "mapag-aruga", "mapagpabaya", "mapagmahal"],
			    correct: 2,
			    explanation: "Ang <b>mapagkandili</b> ay maalaga at mapag-aruga. Ang <b>mapagpabaya</b> ay hindi nagbibigay ng sapat na pangangalaga."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang kaniyang ina ay <i>mapagpala</i> sa mga nangangailangan.",
			    options: ["maawain", "mapagbigay", "maramot", "matulungin"],
			    correct: 2,
			    explanation: "Ang <b>mapagpala</b> ay nagbibigay ng biyaya o kabutihan. Ang <b>maramot</b> ay ayaw magbigay o magbahagi."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Bagaman tanyag siya, nanatili siyang <i>mapagkumbaba</i>.",
			    options: ["mapagmataas", "mahinahon", "magalang", "mapagbigay"],
			    correct: 0,
			    explanation: "Ang <b>mapagkumbaba</b> ay hindi nagmamataas. Ang <b>mapagmataas</b> ay mataas ang tingin sa sarili at maaaring magmalaki sa harap ng iba."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "<i>Masintahin</i> ang binata sa kaniyang mga magulang.",
			    options: ["mapagbigay", "mapagwalang-bahala", "maalaga", "mapagmahal"],
			    correct: 1,
			    explanation: "Ang <b>masintahin</b> ay mapagmahal at maalaga. Ang <b>mapagwalang-bahala</b> ay hindi nagbibigay ng sapat na pansin o malasakit."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "<i>Masaklap</i> ang sinapit ng kaniyang pamilya.",
			    options: ["malungkot", "mapait", "masakit", "maligaya"],
			    correct: 3,
			    explanation: "Ang <b>masaklap</b> ay tumutukoy sa napakasakit, mapait, o kalunos-lunos na karanasan. Ang <b>maligaya</b> ay masaya at kabaligtaran ng ganitong kalagayan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "<i>Marikit</i> ang dalagang inilalarawan sa tula.",
			    options: ["maganda", "kaakit-akit", "karima-rimarim", "marilag"],
			    correct: 2,
			    explanation: "Ang <b>marikit</b> ay maganda at kaaya-aya. Ang <b>karima-rimarim</b> ay lubhang pangit o nakasusuklam."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang tanawin mula sa tuktok ay <i>marilag</i>.",
			    options: ["kahanga-hanga", "karima-rimarim", "marikit", "dakila"],
			    correct: 1,
			    explanation: "Ang <b>marilag</b> ay kahanga-hanga, maringal, o napakaganda. Ang <b>karima-rimarim</b> ay lubhang hindi kaaya-aya."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "<i>Maringal</i> ang seremonya para sa mga pinarangalan.",
			    options: ["engrande", "marilag", "dakila", "payak"],
			    correct: 3,
			    explanation: "Ang <b>maringal</b> ay engrande, marilag, o may malaking karangyaan. Ang <b>payak</b> ay simple at walang karangyaan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "<i>Maramot</i> ang mayamang mangangalakal sa kaniyang mga manggagawa.",
			    options: ["bukas-palad", "sakim", "ganid", "mapagdamot"],
			    correct: 0,
			    explanation: "Ang <b>maramot</b> ay ayaw magbigay o magbahagi. Ang <b>bukas-palad</b> ay mapagbigay at handang tumulong."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang <i>ganid</i> na pinuno ay inangkin pati ang hindi naman kaniya.",
			    options: ["sakim", "mapag-angkin", "mapagbigay", "maramot"],
			    correct: 2,
			    explanation: "Ang <b>ganid</b> ay labis na sakim o mapag-angkin. Ang <b>mapagbigay</b> ay handang magbahagi sa iba."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang kaniyang <i>salawahan</i> na ugali ay naging dahilan upang hindi siya pagkatiwalaan.",
			    options: ["pabagu-bago", "di-mapagkakatiwalaan", "matapat", "hindi palagian"],
			    correct: 2,
			    explanation: "Ang <b>salawahan</b> ay pabago-bago at hindi maaasahan o mapagkakatiwalaan. Ang <b>matapat</b> ay nananatiling tapat at maaasahan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "<i>Mapang-aping</i> pinuno ang naghari sa kanilang bayan.",
			    options: ["malupit", "mapaniil", "makatarungan", "mapag-abuso"],
			    correct: 2,
			    explanation: "Ang <b>mapang-api</b> ay umaapi o gumagamit ng kapangyarihan upang pahirapan ang iba. Ang <b>makatarungan</b> ay patas at nagbibigay ng nararapat sa bawat isa."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "<i>Paham</i> ang matandang guro sa kasaysayan ng kanilang bayan.",
			    options: ["mangmang", "pantas", "marunong", "dalubhasa"],
			    correct: 0,
			    explanation: "Ang <b>paham</b> ay taong marunong o bihasa sa isang larangan. Ang <b>mangmang</b> ay salat sa kaalaman."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang kaniyang paliwanag ay <i>lantad</i> at walang pagtatago.",
			    options: ["hayag", "tahas", "malinaw", "lihim"],
			    correct: 3,
			    explanation: "Ang <b>lantad</b> ay hayag o nakikita at hindi itinatago. Ang <b>lihim</b> ay itinatago at hindi ipinababatid sa iba."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "<i>Lantad</i> ang kaniyang pagkamuhi sa kaniyang karibal.",
			    options: ["hayag", "lingid", "malinaw", "tahas"],
			    correct: 1,
			    explanation: "Ang <b>lantad</b> ay hayag o lantad na ipinakikita. Ang <b>lingid</b> ay nakatago o hindi ipinakikita."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang kaniyang tunay na pagkatao ay <i>lingid</i> sa karamihan.",
			    options: ["lihim", "nakatago", "hayag", "di-nakikita"],
			    correct: 2,
			    explanation: "Ang <b>lingid</b> ay nakatago o hindi nalalaman ng iba. Ang <b>hayag</b> ay lantad at malinaw na nakikita o nalalaman."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "<i>Maamo</i> ang kaniyang mukha ngunit matapang pala ang kaniyang kalooban.",
			    options: ["banayad", "mahinahon", "mabangis", "banayad ang asal"],
			    correct: 2,
			    explanation: "Ang <b>maamo</b> ay banayad at hindi mabagsik. Ang <b>mabangis</b> ay mabagsik o mapanganib ang kilos o asal."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "<i>Mabagsik</i> ang mandirigmang humarap sa kalaban.",
			    options: ["maamo", "malupit", "marahas", "mabangis"],
			    correct: 0,
			    explanation: "Ang <b>mabagsik</b> ay marahas, malupit, o mabangis. Ang <b>maamo</b> ay banayad at hindi mabagsik."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Ang kaniyang kilos ay <i>marahan</i> upang hindi makalikha ng ingay.",
			    options: ["banayad", "dahan-dahan", "mahinahon", "mabigla"],
			    correct: 3,
			    explanation: "Ang <b>marahan</b> ay mabagal o dahan-dahan. Ang <b>mabigla</b> ay mabilis o biglaan ang kilos."
			},
			{
			    subject: "Filipino",
			    subtopic: "Kasalungat",
			    sidebarId: "side-fil-kasal",
			    directions: "Piliin ang salitang kasalungat ng salitang nakapahilig.",
			    question: "Sa kabila ng mga pagsubok, nanatiling <i>matatag</i> ang kaniyang paninindigan.",
			    options: ["matibay", "marupok", "matatag", "di-natitinag"],
			    correct: 1,
			    explanation: "Ang <b>matatag</b> ay hindi madaling matinag, mabuwag, o sumuko. Ang <b>marupok</b> ay madaling masira o matinag."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Nagbibilang ng poste</i> ang binata mula nang mawalan ng trabaho.",
			    options: ["naghahanap ng mapapasukang bahay", "walang pinagkakaabalahan", "naglalakad sa lansangan", "nagbabantay ng ari-arian"],
			    correct: 1,
			    explanation: "Ang <b>nagbibilang ng poste</b> ay nangangahulugang walang trabaho o walang pinagkakaabalahan. Hindi ito literal na pagbibilang ng mga poste."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "Dahil sa kaniyang kasalanan, <i>nagbabaon ng mukha sa kahihiyan</i> ang binata.",
			    options: ["nagtatago sa isang lugar", "lubhang nahihiya", "natatakot sa kapwa", "nagsisisi sa kaniyang ginawa"],
			    correct: 1,
			    explanation: "Ang <b>nagbabaon ng mukha sa kahihiyan</b> ay nangangahulugang labis na nahihiya dahil sa isang pagkakamali o kahiya-hiyang pangyayari."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Mababaw ang luha</i> ni Ana kaya madaling maantig ang kaniyang damdamin.",
			    options: ["madaling matuwa", "madaling magalit", "madaling maiyak", "madaling makalimot"],
			    correct: 2,
			    explanation: "Ang <b>mababaw ang luha</b> ay tumutukoy sa taong madaling maiyak o maantig ang damdamin."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Nagsusunog ng kilay</i> si Marco bago ang pagsusulit.",
			    options: ["masikap na nag-aaral", "nagbabasa nang walang pahinga", "nagpupuyat dahil sa trabaho", "nagsusulat ng maraming tala"],
			    correct: 0,
			    explanation: "Ang <b>nagsusunog ng kilay</b> ay nangangahulugang masigasig o masikap na nag-aaral."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "Huwag kang <i>magbilang ng sisiw habang hindi pa napipisa ang itlog</i>.",
			    options: ["huwag mag-alaga ng manok", "huwag gumawa ng desisyon", "huwag umasa sa bagay na hindi pa tiyak", "huwag maghintay ng matagal"],
			    correct: 2,
			    explanation: "Ang kawikaang ito ay nagbababala laban sa pag-aakalang tiyak na ang isang bagay bago pa ito mangyari."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Itaga mo sa bato</i> ang sinabi kong tutuparin ko ang aking pangako.",
			    options: ["isulat ito sa isang bato", "makatitiyak ka sa sinabi ko", "huwag mong kalimutan ang pangyayari", "ipaalam mo ito sa iba"],
			    correct: 1,
			    explanation: "Ang <b>itaga sa bato</b> ay nangangahulugang makatitiyak o lubos na mapagkakatiwalaan ang sinabi."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Namuti na ang kaniyang mga mata</i> sa kakahintay sa anak.",
			    options: ["matagal nang nagdurusa", "matagal nang naghihintay", "hindi na makakita nang mabuti", "nawalan na ng pag-asa"],
			    correct: 1,
			    explanation: "Ang <b>namuti na ang mga mata</b> ay nangangahulugang napakatagal nang naghihintay."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "Huwag mong <i>bilugin ang ulo</i> ng bata sa dami ng iyong sinasabi.",
			    options: ["pagalitan siya", "lituhin siya sa pag-aaral", "lituhin o linlangin siya", "turuan siya nang mabuti"],
			    correct: 2,
			    explanation: "Ang <b>bilugin ang ulo</b> ay nangangahulugang lituhin, lokohin, o impluwensiyahan ang isang tao."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Mabigat ang kamay</i> ng ama sa kaniyang mga anak.",
			    options: ["malakas siyang gumawa", "madaling manakit o mamalo", "masipag siyang magtrabaho", "mahigpit siyang magdisiplina"],
			    correct: 1,
			    explanation: "Ang <b>mabigat ang kamay</b> ay karaniwang tumutukoy sa taong madaling manakit o mamalo."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Matalas ang dila</i> ng matandang babae.",
			    options: ["mahusay magsalita", "maraming alam na salita", "masakit o mapanakit magsalita", "mabilis sumagot sa tanong"],
			    correct: 2,
			    explanation: "Ang <b>matalas ang dila</b> ay tumutukoy sa taong mapanakit, matalas, o masakit magsalita."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Makapal ang mukha</i> niya dahil hindi siya nahiya sa kaniyang ginawa.",
			    options: ["matapang", "walang hiya", "matigas ang ulo", "walang pakialam"],
			    correct: 1,
			    explanation: "Ang <b>makapal ang mukha</b> ay nangangahulugang walang hiya o hindi madaling mahiya."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Mataas ang lipad</i> ng bagong empleyado.",
			    options: ["mataas ang ambisyon", "mahusay lumipad", "mataas ang katayuan", "maraming pangarap sa buhay"],
			    correct: 0,
			    explanation: "Ang <b>mataas ang lipad</b> ay nangangahulugang mataas ang ambisyon o pangarap ng isang tao."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "Huwag kang <i>magtaingang-kawali</i> kapag pinapayuhan ka ng iyong mga magulang.",
			    options: ["magkunwaring hindi nakikita", "magkunwaring hindi naririnig", "sumagot nang pabalang", "umiwas sa pakikipag-usap"],
			    correct: 1,
			    explanation: "Ang <b>magtaingang-kawali</b> ay sadyang hindi pakikinig o pagkukunwaring hindi naririnig ang sinasabi."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Maitim ang budhi</i> ng taong iyon.",
			    options: ["malungkot ang kalooban", "maraming suliranin", "masama ang kalooban", "mahirap kausapin"],
			    correct: 2,
			    explanation: "Ang <b>maitim ang budhi</b> ay tumutukoy sa taong may masamang kalooban o masamang hangarin."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Mababa ang loob</i> ni Teresa kaya hindi siya nagyayabang.",
			    options: ["mahina ang loob", "mapagkumbaba", "madaling matakot", "tahimik magsalita"],
			    correct: 1,
			    explanation: "Ang <b>mababa ang loob</b> ay nangangahulugang mapagkumbaba at hindi palalo."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Mataas ang noo</i> niyang humarap sa mga tao matapos ang tagumpay.",
			    options: ["may dangal at tiwala sa sarili", "mayabang sa kapwa", "hindi natatakot sa tao", "masaya sa kaniyang tagumpay"],
			    correct: 0,
			    explanation: "Ang <b>mataas ang noo</b> ay maaaring mangahulugang may dangal, marangal, o walang dapat ikahiya."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Nasa alanganin ang buhay</i> ng maysakit.",
			    options: ["mahirap ang kalagayan", "nasa panganib", "mahina ang katawan", "malubha ang karamdaman"],
			    correct: 1,
			    explanation: "Ang <b>nasa alanganin</b> ay nasa hindi tiyak o mapanganib na kalagayan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Kapit sa patalim</i> ang pamilya upang makaraos sa kanilang suliranin.",
			    options: ["gumagawa ng mapanganib na gawain", "gumagawa ng anumang paraan dahil sa matinding pangangailangan", "humihingi ng tulong sa mayaman", "nagsasakripisyo para sa pamilya"],
			    correct: 1,
			    explanation: "Ang <b>kapit sa patalim</b> ay paggamit ng kahit mapanganib o hindi kanais-nais na paraan dahil sa matinding pangangailangan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Naglubid ng buhangin</i> ang mga tauhan upang matupad ang imposibleng utos.",
			    options: ["gumawa nang mabagal", "gumawa ng bagay na halos imposibleng maisagawa", "gumawa ng bagay na walang halaga", "nagsayang ng materyales"],
			    correct: 1,
			    explanation: "Ang <b>naglubid ng buhangin</b> ay matalinghagang pahayag para sa paggawa ng isang bagay na napakahirap o halos imposible."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Nagtanim ng sama ng loob</i> si Rosa sa kaniyang kapatid.",
			    options: ["nagtago ng galit", "nagkimkim ng hinanakit", "nagalit nang sandali", "hindi nakipag-usap"],
			    correct: 1,
			    explanation: "Ang <b>nagtanim ng sama ng loob</b> ay nagkimkim o nag-ipon ng hinanakit laban sa isang tao."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "Huwag mong <i>sunugin ang tulay</i> na maaaring kailanganin mo balang araw.",
			    options: ["sirain ang isang bagay na mahalaga", "putulin ang ugnayang maaaring kailanganin pa", "iwasan ang dating kaibigan", "kalimutan ang nakaraan"],
			    correct: 1,
			    explanation: "Ang <b>sunugin ang tulay</b> ay nangangahulugang tuluyang putulin ang ugnayan o posibilidad na makabalik sa dating kalagayan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Nasa dulo ng dila</i> ko ang pangalan niya ngunit hindi ko maalala.",
			    options: ["malapit nang sabihin", "halos maalala o mabigkas", "gustong-gustong sabihin", "ayaw banggitin"],
			    correct: 1,
			    explanation: "Ang <b>nasa dulo ng dila</b> ay tumutukoy sa bagay na halos maalala o mabigkas ngunit hindi pa maibigay nang wasto."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Bukas ang palad</i> ng alkalde sa mga nangangailangan.",
			    options: ["mahusay mamuno", "mapagbigay", "palakaibigan", "matulungin sa trabaho"],
			    correct: 1,
			    explanation: "Ang <b>bukas ang palad</b> ay nangangahulugang mapagbigay o handang magbahagi."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Isang kahig, isang tuka</i> ang kanilang pamumuhay.",
			    options: ["payak ang kanilang pamumuhay", "sapat lamang ang kinikita para sa pang-araw-araw na pangangailangan", "marami silang gastusin", "wala silang pinagkakakitaan"],
			    correct: 1,
			    explanation: "Ang <b>isang kahig, isang tuka</b> ay tumutukoy sa pamumuhay na sapat lamang ang kinikita para sa araw-araw na pangangailangan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Nagbukas ng dibdib</i> si Ana sa kaniyang matalik na kaibigan.",
			    options: ["nagsabi ng kaniyang problema", "nagsiwalat ng niloloob o saloobin", "humingi ng payo", "nagsabi ng kaniyang sikreto"],
			    correct: 1,
			    explanation: "Ang <b>nagbukas ng dibdib</b> ay nagsiwalat ng malalim na saloobin, damdamin, o iniisip."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Nagbukas ng bibig</i> ang saksi tungkol sa matagal niyang nalalaman.",
			    options: ["nagsalita nang malakas", "nagsiwalat ng nalalaman", "sumagot sa tanong", "nagbigay ng opinyon"],
			    correct: 1,
			    explanation: "Sa ganitong gamit, ang <b>nagbukas ng bibig</b> ay nangangahulugang nagsalita o nagsiwalat ng impormasyong dati ay itinatago."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Naglaba ng maruming damit</i> sa harap ng maraming tao ang dalawang magkaibigan.",
			    options: ["naglinis ng kanilang damit", "naglantad ng kanilang lihim o away", "nagkuwentuhan tungkol sa kanilang buhay", "nagsumbatan nang tahimik"],
			    correct: 1,
			    explanation: "Ang <b>paglalaba ng maruming damit</b> ay paglalantad ng pribadong problema, lihim, o alitan sa publiko."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Nagbuhat ng sariling bangko</i> ang kandidato sa kaniyang talumpati.",
			    options: ["nagpakitang-gilas", "pinuri ang sarili", "nagsalita nang matapang", "ipinagtanggol ang sarili"],
			    correct: 1,
			    explanation: "Ang <b>nagbuhat ng sariling bangko</b> ay nangangahulugang labis na pinupuri o ipinagmamalaki ang sarili."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Nag-ihaw ng sariling baboy</i> ang taong palaging nagmamataas.",
			    options: ["nagdiwang nang mag-isa", "sariling kapakanan lamang ang iniisip", "gumawa ng sariling desisyon", "nagtrabaho nang walang tulong"],
			    correct: 1,
			    explanation: "Ang pahayag ay ginagamit upang ilarawan ang taong inuuna o pinakikinabangan ang sariling kapakanan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Naglalaro sa apoy</i> ang taong paulit-ulit na lumalabag sa batas.",
			    options: ["gumagawa ng mapanganib na laro", "sinusubok ang isang mapanganib na sitwasyon", "hindi natatakot sa panganib", "gumagawa ng ilegal na gawain"],
			    correct: 1,
			    explanation: "Ang <b>naglalaro sa apoy</b> ay sadyang pagpasok o paggawa ng bagay na maaaring humantong sa panganib o kapahamakan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "Huwag mong <i>hukayin ang nakaraan</i> kung nais mong magkaroon ng kapayapaan.",
			    options: ["alalahanin ang mga dating pangyayari", "balikan o ungkatin ang dating problema", "alamin ang kasaysayan", "pag-aralan ang mga pagkakamali"],
			    correct: 1,
			    explanation: "Ang <b>hukayin ang nakaraan</b> ay nangangahulugang muling ungkatin ang mga dating problema o pangyayaring nais nang kalimutan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Nagbibilang ng araw</i> ang matanda bago siya magretiro.",
			    options: ["sinusukat ang kaniyang edad", "hinihintay ang nalalapit na pangyayari", "nag-aalala sa kaniyang kinabukasan", "nagbabalak ng paglalakbay"],
			    correct: 1,
			    explanation: "Ang <b>nagbibilang ng araw</b> ay naghihintay sa pagdating ng isang tiyak o mahalagang pangyayari."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Nasa kamay niya ang kapalaran</i> ng buong samahan.",
			    options: ["siya ang namamahala", "nakasalalay sa kaniya ang magiging resulta", "siya ang may pinakamalaking kapangyarihan", "siya ang gumagawa ng lahat ng desisyon"],
			    correct: 1,
			    explanation: "Ang <b>nasa kamay niya ang kapalaran</b> ay nangangahulugang nakasalalay sa kaniyang kilos o pasya ang magiging resulta."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>May gatas pa sa labi</i> ang bagong empleyado.",
			    options: ["bata pa siya", "kulang pa sa karanasan", "hindi pa siya marunong", "bagong salta siya sa trabaho"],
			    correct: 1,
			    explanation: "Ang <b>may gatas pa sa labi</b> ay tumutukoy sa taong bata pa o kulang pa sa karanasan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>May bahid ng pagdududa</i> ang kaniyang pahayag.",
			    options: ["may mali sa kaniyang sinabi", "may kaunting pag-aalinlangan", "hindi siya nagsasabi ng totoo", "may itinatago siyang impormasyon"],
			    correct: 1,
			    explanation: "Ang <b>bahid ng pagdududa</b> ay nangangahulugang may kaunting pag-aalinlangan o kawalan ng katiyakan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>May pakpak ang balita</i> kaya mabilis itong kumalat.",
			    options: ["madaling mapatunayan ang balita", "mabilis kumalat ang balita", "maraming taong nakarinig nito", "mahirap pigilan ang mga tao"],
			    correct: 1,
			    explanation: "Ang <b>may pakpak ang balita</b> ay nangangahulugang napakabilis kumalat ng isang balita."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>May ahas sa dibdib</i> ang taong pinagkakatiwalaan nila.",
			    options: ["may kinatatakutang tao", "may lihim na pagtataksil o masamang hangarin", "mapanganib na tao", "maraming kaaway"],
			    correct: 1,
			    explanation: "Ang <b>may ahas sa dibdib</b> ay tumutukoy sa taong itinuturing na kaibigan ngunit may pagtataksil o masamang hangarin."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>May dalawang mukha</i> ang taong iyon.",
			    options: ["hindi mapagkakatiwalaan", "magkaiba ang ipinakikita at tunay na asal", "mahusay makitungo sa lahat", "nagbabago ng kaniyang opinyon"],
			    correct: 1,
			    explanation: "Ang <b>may dalawang mukha</b> ay taong nagpapakita ng magkaibang asal o pakikitungo depende sa kaniyang kaharap."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>May itim na tupa</i> sa kanilang pamilya.",
			    options: ["may miyembrong mahirap turuan", "may miyembrong naiiba o masama ang reputasyon", "may taong ayaw makisama", "may miyembrong palaging nag-iisa"],
			    correct: 1,
			    explanation: "Ang <b>itim na tupa</b> ay taong naiiba sa kaniyang pangkat o pamilya, kadalasan ay dahil sa hindi kanais-nais na asal o reputasyon."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>May gulong ang dila</i> ng kanilang kapitbahay.",
			    options: ["mabilis magsalita", "madaldal at mahilig magkuwento", "hindi marunong mag-ingat sa salita", "mahilig makipagtalo"],
			    correct: 1,
			    explanation: "Ang <b>may gulong ang dila</b> ay tumutukoy sa taong mabilis at tuluy-tuloy magsalita o labis na madaldal."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Nasa ulap ang isip</i> ng estudyante habang nagtuturo ang guro.",
			    options: ["malalim mag-isip", "hindi nakapagtutuon ng pansin", "maraming iniisip na problema", "malikhain mag-isip"],
			    correct: 1,
			    explanation: "Ang <b>nasa ulap ang isip</b> ay nangangahulugang hindi nakatuon ang isip sa kasalukuyang ginagawa."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Nasa bingit ng kapahamakan</i> ang mga manlalakbay.",
			    options: ["malapit sa isang bangin", "malapit nang mapahamak", "nasa mapanganib na lugar", "hindi alam ang pupuntahan"],
			    correct: 1,
			    explanation: "Ang <b>nasa bingit ng kapahamakan</b> ay nasa kalagayang napakalapit sa panganib o kapahamakan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Nasa sukdulan ang kaniyang galit</i> sa nangyari.",
			    options: ["napipigilan ang galit", "pinakamataas ang antas ng galit", "matagal nang nagagalit", "ayaw nang makipag-usap"],
			    correct: 1,
			    explanation: "Ang <b>sukdulan</b> ay pinakamataas o pinakamatinding antas. Kaya ang pahayag ay nangangahulugang napakatindi ng kaniyang galit."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Kumakain ng alikabok</i> ang ibang mananakbo sa karera.",
			    options: ["natatalo sa karera", "nahuhuli o napag-iiwanan", "pagod na pagod", "tumatakbo nang mabagal"],
			    correct: 1,
			    explanation: "Ang <b>kumakain ng alikabok</b> ay idyomatikong nangangahulugang napag-iiwanan o natatalo sa isang paligsahan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Kumakain sa malaking hapag</i> ang mga taong may mataas na katayuan sa lipunan.",
			    options: ["maraming pagkain ang kinakain", "mayaman at makapangyarihan", "masaganang namumuhay", "maraming kaibigan"],
			    correct: 1,
			    explanation: "Ang <b>kumakain sa malaking hapag</b> ay maaaring gamitin sa matalinghagang diwa para sa mga taong nakikinabang sa yaman, kapangyarihan, o mataas na katayuan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Nalaglag ang panga</i> ng mga manonood nang makita ang resulta.",
			    options: ["nagulat", "labis na namangha", "natakot", "hindi makapaniwala sa sarili"],
			    correct: 1,
			    explanation: "Ang <b>nalaglag ang panga</b> ay nangangahulugang labis na namangha o nagulat sa isang hindi inaasahang bagay."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Nalaglag sa kandungan</i> ng kalaban ang tagumpay.",
			    options: ["biglang nawala ang pagkakataon", "madaling napunta sa iba ang isang bagay", "natalo nang hindi lumaban", "hindi inaasahang nagtagumpay"],
			    correct: 1,
			    explanation: "Ang <b>nalaglag sa kandungan</b> ay tumutukoy sa bagay na madaling napunta sa isang tao nang hindi niya gaanong pinaghirapan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Nagbuhol ang dila</i> ng saksi nang tanungin siya ng hukom.",
			    options: ["hindi makapagsalita nang malinaw", "nahirapang magsalita dahil sa kaba", "nakalimutan ang kaniyang sasabihin", "tumangging sumagot"],
			    correct: 1,
			    explanation: "Ang <b>nagbuhol ang dila</b> ay nangangahulugang nahirapang magsalita nang maayos, kadalasan dahil sa kaba, takot, o pagkalito."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "<i>Nagtago sa likod ng palda</i> ang binata nang dumating ang mga maniningil.",
			    options: ["nagtago sa kaniyang ina", "umiwas sa pananagutan o panganib", "natakot sa mga tao", "ayaw makipag-usap sa iba"],
			    correct: 1,
			    explanation: "Ang <b>nagtago sa likod ng palda</b> ay matalinghagang tumutukoy sa taong umaasa o nagkukubli sa ilalim ng proteksiyon ng iba upang makaiwas sa pananagutan."
			},
			{
			    subject: "Filipino",
			    subtopic: "Mga Kawikaan",
			    sidebarId: "side-fil-kawi",
			    directions: "Piliin ang salitang kasing-kahulugan ng salitang nakapahilig.",
			    question: "Sa kabila ng mga problema, <i>hawak sa leeg ang pagkakataon</i> ng koponan upang makamit ang kampeonato.",
			    options: ["malapit nang matalo", "malaki pa ang posibilidad na magtagumpay", "kontrolado ang kalaban", "nakasalalay sa swerte ang tagumpay"],
			    correct: 1,
			    explanation: "Ang pahayag ay nagpapahiwatig na nasa kritikal ngunit paborableng kalagayan pa ang isang panig at may mahalagang pagkakataon pa itong makamit ang layunin."
			},
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Hindi ko alam ______ dumating ang bagong guro kahapon.",
		        options: ["kapag", "kong kailan", "kung kailan", "nang kailan"],
		        correct: 2,
		        explanation: "<b>Kung kailan</b> ang wastong gamit dahil nagpapahayag ito ng hindi tiyak na impormasyon o katanungang di-tuwiran ukol sa panahon."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ may pagkakataon kang makausap siya, sabihin mo ang buong katotohanan.",
		        options: ["Kung", "Kapag", "Kong", "Nang"],
		        correct: 1,
		        explanation: "<b>Kapag</b> ang ginagamit kapag tumutukoy sa isang tiyak o inaasahang pangyayari na mangyayari sa hinaharap."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Hindi niya sinabi ______ dadalo siya sa pagpupulong.",
		        options: ["kapag", "kong", "kung", "nang"],
		        correct: 2,
		        explanation: "<b>Kung</b> ang wastong gamitin sa pagpapahayag ng alinlangan o di-tiyak na kalagayan (pagsusuri kung oo o hindi)."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Sinabi ______ hindi na raw siya makadadalo sa pagpupulong.",
		        options: ["niya", "kaniya", "niyang", "kanyang"],
		        correct: 2,
		        explanation: "<b>Niyang</b> (niya + -ng) ang wastong anyo dahil nag-uugnay ito sa sugnay na nagsasaad ng kaniyang sinabi."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Nag-aral siya ______ mabuti upang makapasa sa pagsusulit.",
		        options: ["ng", "na", "nang", "mga"],
		        correct: 2,
		        explanation: "<b>Nang</b> ang ginagamit bilang pang-abay na nagsasaad ng paraan ng pagkakagawa ng kilos (paano nag-aral? -> nang mabuti)."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Bumili ang guro ______ bagong mga aklat para sa silid-aklatan.",
		        options: ["nang", "na", "mga", "ng"],
		        correct: 3,
		        explanation: "<b>Ng</b> ang ginagamit bilang pananda ng tuwirang layon ng pandiwang bumili (bumili ng ano? -> ng mga aklat)."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ dumating ang punong-guro, agad na tumahimik ang mga mag-aaral.",
		        options: ["Ng", "Nang", "Na", "Kung"],
		        correct: 1,
		        explanation: "<b>Nang</b> ang ginagamit bilang kasingkahulugan ng 'noong' o upang ipakita ang tiyak na sandali ng pagkakaganap ng kilos."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Hindi ko matandaan ______ ko inilagay ang mahalagang dokumento.",
		        options: ["kapag", "kong saan", "kung saan", "nang saan"],
		        correct: 2,
		        explanation: "<b>Kung saan</b> ang wastong parirala para sa di-tiyak na lugar o lokasyon."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Sumama ______ ang kaniyang kapatid sa pagpunta sa palengke.",
		        options: ["din", "daw", "rin", "raw"],
		        correct: 2,
		        explanation: "<b>Rin</b> ang ginagamit kapag ang sinusundang salita (sumama) ay nagtatapos sa patinig (a, e, i, o, u) o malapatinig (w, y)."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Hindi ______ makadadalo ang ibang miyembro sa pagpupulong.",
		        options: ["rin", "din", "raw", "daw"],
		        correct: 0,
		        explanation: "<b>Rin</b> ang gagamitin dahil ang sinusundang salita na hindi ay nagtatapos sa patinig na /i/."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Hindi ako sasama ______ umuulan nang malakas.",
		        options: ["kung", "kong", "nang", "upang"],
		        correct: 0,
		        explanation: "<b>Kung</b> ang ginagamit upang magpahayag ng kondisyon o pasubali."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ ayaw mong sumali, maaari kang manatili rito.",
		        options: ["Kapag", "Kong", "Kung", "Nang"],
		        correct: 2,
		        explanation: "<b>Kung</b> ang gagamitin dahil ito ay nagpapahayag ng kondisyon sa simula ng pangungusap."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ sa ulat ng komite, natapos na ang imbestigasyon.",
		        options: ["Ayon kay", "Ayon kina", "Ayon sa", "Ayun kay"],
		        correct: 2,
		        explanation: "<b>Ayon sa</b> ang ginagamit kapag ang kasunod ay pambalana (bagay, ulat, dokumento, batas)."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Ibinigay niya ang sulat ______ Maria bago siya umalis.",
		        options: ["sina", "kay", "kina", "sila"],
		        correct: 1,
		        explanation: "<b>Kay</b> ang ginagamit kapag tumutukoy sa iisang tanging pangalan ng tao."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Ipinadala ang mga dokumento ______ Ana at Roberto.",
		        options: ["kay", "sina", "sila", "kina"],
		        correct: 3,
		        explanation: "<b>Kina</b> ang ginagamit kapag tumutukoy sa dalawa o higit pang tanging pangalan ng tao."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ akong kailangang tapusin bago matapos ang araw.",
		        options: ["Mayroon", "Magkaroon", "May", "Nagkaroon"],
		        correct: 2,
		        explanation: "<b>May</b> ang ginagamit kapag sinusundan ng pandiwa, pang-uri, pangngalan, o pang-abay (may kailangang...)."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ ba kayong tanong tungkol sa panuto?",
		        options: ["May", "Mayroon", "Magkaroon", "Nagkaroon"],
		        correct: 1,
		        explanation: "<b>Mayroon</b> ang ginagamit kapag sinusundan ng panghalip na panao sa anyong atag (kayo)."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Dalawang linggo ______ ang nakalipas mula nang isumite niya ang dokumento.",
		        options: ["ng", "nang", "na", "din"],
		        correct: 2,
		        explanation: "<b>Na</b> ang pang-angkop/kataga na ginagamit sa pagsasaad ng naganap na panahon."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ niya ang kaniyang pagkakamali matapos suriin ang mga ebidensiya.",
		        options: ["Umamin", "Inamin", "Umaminan", "Umaamin"],
		        correct: 1,
		        explanation: "<b>Inamin</b> (pokus sa layon) ang ginagamit dahil may tuwirang layon ang pangungusap (ang kaniyang pagkakamali)."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ siya sa kaniyang pagkakamali sa harap ng buong klase.",
		        options: ["Umamin", "Inamin", "Inaminan", "Umaaminan"],
		        correct: 0,
		        explanation: "<b>Umamin</b> (pokus sa tagaganap) ang ginagamit dahil ang simuno/paksa (siya) ang mismong gumawa ng kilos."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Huwag mong ______ ang mga tagubilin ng punong-guro.",
		        options: ["sundan", "sinusundan", "sundin", "nasundan"],
		        correct: 2,
		        explanation: "<b>Sundin</b> (obey) ang ginagamit para sa payo, utos, tuntunin, o batas."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ mo ang taong may dalang pulang payong upang hindi ka maligaw.",
		        options: ["Sundin", "Sundan", "Sinunod", "Sundinan"],
		        correct: 1,
		        explanation: "<b>Sundan</b> (follow/track) ang ginagamit kapag tutuntunin o susundan ang kinaroroonan o gawi ng isang tao o bagay."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ mo ang pawis sa kaniyang noo.",
		        options: ["Punasan", "Punasin", "Pumunas", "Napunasan"],
		        correct: 0,
		        explanation: "<b>Punasan</b> ang ginagamit kapag inaalis ang isang bagay mula sa isang ibabaw o bahagi ng katawan (punasan ang pawis sa noo)."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ mo ang mesa bago ihain ang pagkain.",
		        options: ["Punasan", "Punasin", "Pumunas", "Napunas"],
		        correct: 0,
		        explanation: "<b>Punasan</b> ang ginagamit kapag ang mismong lugar o ibabaw ang lilinisin (punasan ang mesa)."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ mo ang luha sa kaniyang mga mata.",
		        options: ["Pahiran", "Pahirin", "Pahiranin", "Pumahid"],
		        correct: 0,
		        explanation: "<b>Pahiran</b> ang wastong gamit kapag nag-aalis ng bagay (luha/pawis) sa isang tao o bahagi ng katawan."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ mo ng gamot ang sugat bago ito bendahehin.",
		        options: ["Pahirin", "Pahiran", "Pahid", "Pumahid"],
		        correct: 1,
		        explanation: "<b>Pahiran</b> din ang ginagamit kapag naglalagay ng isang bagay sa ibabaw ng iba (pahiran ng gamot)."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ mo ang buong dokumento bago mo ito lagdaan.",
		        options: ["Basihan", "Bumasa", "Basahin", "Binasa"],
		        correct: 2,
		        explanation: "<b>Basahin</b> ang gagamitin dahil ang dokumento ang tuwirang layon na babasahin."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ mo muna ang proseso bago gumawa ng desisyon.",
		        options: ["Unawain", "Umunawa", "Unawanan", "Nauunawaan"],
		        correct: 0,
		        explanation: "<b>Unawain</b> ang wastong anyo ng pandiwa sa pautos na pokus sa layon."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ mong mabuti ang mga dokumento bago isumite ang mga ito.",
		        options: ["Suri", "Suriin", "Surihan", "Sinusuri"],
		        correct: 1,
		        explanation: "<b>Suriin</b> ang wastong pandiwa para sa pagsisiyasat ng isang bagay/dokumento."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Kailangan mong ______ ang lahat ng tuntunin bago sumali sa paligsahan.",
		        options: ["isaalang-alangan", "isaalang-alang", "isinasaalang", "mag-isip-alang"],
		        correct: 1,
		        explanation: "<b>Isaalang-alang</b> ang tamang pariralang pawatas na nangangahulugang isipin o bigyang-halaga."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ mo ang kaniyang mungkahi bago ito tuluyang tanggihan.",
		        options: ["Pag-isipan", "Pag-isipin", "Mag-isip", "Pinag-isipan"],
		        correct: 0,
		        explanation: "<b>Pag-isipan</b> ang ginagamit kapag may partikular na paksa o mungkahi na tututuunan ng pag-iisip."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ sa batas ang ginawa nilang hakbang.",
		        options: ["Sumunod", "Alinsunod", "Sinunod", "Pagsunod"],
		        correct: 1,
		        explanation: "<b>Alinsunod</b> ang ginagamit bilang pang-ugnay na nangangahulugang naaayon sa (Alinsunod sa batas...)."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ sa bagong patakaran, kailangang magsumite ng ulat bago Biyernes.",
		        options: ["Ayon kay", "Alinsunod", "Dahil kay", "Tungkol kay"],
		        correct: 1,
		        explanation: "<b>Alinsunod</b> ang pampanitikang gamit para sa pagtalima sa patakaran o alituntunin."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Hindi siya pumasok ______ siya ay may mataas na lagnat.",
		        options: ["dahil", "upang", "ngunit", "kung"],
		        correct: 0,
		        explanation: "<b>Dahil</b> ang pangatnig na nag-uugnay sa sugnay na nagpapakita ng sanhi o dahilan."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Hindi siya pumasok ______ kaniyang karamdaman.",
		        options: ["dahil kay", "dahil", "dahil sa", "dahil kina"],
		        correct: 2,
		        explanation: "<b>Dahil sa</b> ang ginagamit kapag pambalana o pangngalang di-tao ang sanhi (karamdaman)."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Hindi siya nakadalo ______ kaniyang ina.",
		        options: ["dahil sa", "dahil kay", "dahil kina", "dahil"],
		        correct: 1,
		        explanation: "<b>Dahil kay</b> ang ginagamit kapag tanging tao ang dahilan."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Ang seminar ay ginanap ______ kaligtasan sa paggawa.",
		        options: ["tungkol kay", "tungkol kina", "tungkol sa", "ukol kay"],
		        correct: 2,
		        explanation: "<b>Tungkol sa</b> ang ginagamit kapag ang paksa ay pambalana o pangkalahatang paksa (kaligtasan)."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Ang liham ay ______ bagong patakaran ng tanggapan.",
		        options: ["tungkol kay", "tungkol sa", "tungkol kina", "ukol kay"],
		        correct: 1,
		        explanation: "<b>Tungkol sa</b> ang tamang pananda sa paksang hindi tao (patakaran)."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Ang desisyon ay ginawa ______ kapakanan ng mga mag-aaral.",
		        options: ["tungkol sa", "dahil sa", "para sa", "ayon kay"],
		        correct: 2,
		        explanation: "<b>Para sa</b> ang ginagamit sa pagsasaad ng pinag-uukulan o layunin."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Ang liham ay ipinadala ______ punong-guro.",
		        options: ["para sa", "para kay", "para kina", "tungkol sa"],
		        correct: 1,
		        explanation: "<b>Para kay</b> ang ginagamit kapag tiyak na iisang tao ang pinag-uukulan."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Ang mga sertipiko ay inihanda ______ Ana at Ben.",
		        options: ["para kay", "tungkol kina", "para kina", "ayon sa"],
		        correct: 2,
		        explanation: "<b>Para kina</b> ang ginagamit kapag higit sa isang tao ang pinag-uukulan."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ mga saksi, nagsimula ang insidente bandang alas-diyes.",
		        options: ["Ayon sa", "Ayon kay", "Ayon kina", "Ayun sa"],
		        correct: 0,
		        explanation: "<b>Ayon sa</b> ang tamang gamit dahil ang 'mga saksi' ay isang pangngalang pambalana na may panandang mga."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ Ana at Ben, nagsimula ang insidente bandang alas-diyes.",
		        options: ["Ayon sa", "Ayon kay", "Ayon kina", "Ayun kina"],
		        correct: 2,
		        explanation: "<b>Ayon kina</b> ang ginagamit kapag tinutukoy ang dalawa o higit pang tiyak na pangalan ng tao."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ Ana ang nawawalang dokumento.",
		        options: ["Ayon sa", "Kay", "Kina", "Sina"],
		        correct: 1,
		        explanation: "<b>Kay</b> ang panandang nagpapakita ng pagmamay-ari o kinaroroonan ng iisang tao."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ Ana at Ben ang mga dokumentong ito.",
		        options: ["Kay", "Sina", "Kina", "Sila"],
		        correct: 2,
		        explanation: "<b>Kina</b> ang nagpapakita ng pagmamay-ari para sa dalawa o higit pang tao."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ Ana at Ben ang mga nanguna sa proyekto.",
		        options: ["Sina", "Sila", "Kina", "Kay"],
		        correct: 0,
		        explanation: "<b>Sina</b> ang pantukoy sa mga pangalan ng taong gumaganap bilang simuno."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ ang nanguna sa proyekto.",
		        options: ["Sina Ana at Ben", "Kina Ana at Ben", "Sila", "Sina sila"],
		        correct: 2,
		        explanation: "<b>Sila</b> ang panghalip panao na pumapalit sa dalawa o higit pang tao na siyang simuno."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Ito ang aklat ______ isinulat niya noong nakaraang taon.",
		        options: ["na kaniyang", "na", "nang", "ng"],
		        correct: 1,
		        explanation: "<b>Na</b> ang pang-angkop na nag-uugnay sa salitang aklat at sa sugnay na pampalawak nito."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "Ito ang ______ gusaling itinayo ng pamahalaan.",
		        options: ["mataas na", "mataas nang", "mataas ng", "mataas pa"],
		        correct: 0,
		        explanation: "<b>Mataas na</b> ang tamang parirala gamit ang pang-angkop na na na nag-uugnay sa pang-uri (mataas) at pangngalan (gusali)."
		    },
		    {
		        subject: "Filipino",
		        subtopic: "Wastong Gamit",
		        sidebarId: "side-fil-wast",
		        directions: "Piliin ang titik ng salitang angkop sa patlang.",
		        question: "______ magsisikap kang mabuti, malaki ang posibilidad na makamit mo ang iyong layunin.",
		        options: ["Dahil", "Nang", "Kung", "Sapagkat"],
		        correct: 2,
		        explanation: "<b>Kung</b> ang pangatnig na ginagamit sa pagpapahayag ng kondisyon o syarat."
		    },
			{
                subject: "Filipino",
                subtopic: "Wastong Gamit",
                sidebarId: "side-fil-wast",
                directions: "Mga Panuto: Piliin ang pinakawastong sagot para sa bawat patlang.",
                question: "Maaari bang bigyan ng 10 taon na lisensya ang isang drayber kung ito ay mayroong huli o traffic violation?",
                options: ["Hindi", "Oo", "Oo kung ang penalty ay nabayaran labinlimang taon bago mag-renew"],
                correct: 0
            }
        ];

        const analyticalPool = [
            {
                subject: "Inductive Reasoning",
                subtopic: "Inductive Reasoning",
                sidebarId: "side-ana-ind",
                directions: "Directions: Look for patterns and determine the logical next sequence or relationship.",
                question: "Look at this series: 2, 1, (1/2), (1/4), ... What number should come next?",
                options: ["(1/3)", "(1/8)", "(1/10)", "(1/16)"],
                correct: 1
            }
        ];

        const generalInfoPool = [
            {
                subject: "Philippine Constitution",
                subtopic: "Philippine Constitution",
                sidebarId: "side-gen-const",
                directions: "Directions: Choose the correct answer based on the 1987 Philippine Constitution.",
                question: "Who among the following may initiate the impeachment of public officials under the Constitution?",
                options: ["House of Representatives", "Senate", "Supreme Court", "Office of the Ombudsman"],
                correct: 0
            }
        ];

