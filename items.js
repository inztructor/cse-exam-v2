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

