"use strict";
/**
 * NEP REVISION 2023 (2.0) - MIT Academy of Engineering, Alandi
 * Curriculum Knowledge Base for AI Recommendation Engine
 * 
 * Algorithm: Content-Based Filtering + Rule-Based Importance Classification
 * Each subject is classified by:
 *   - importance_tier: 1 (critical) | 2 (important) | 3 (standard)
 *   - career_tags: what jobs/domains this leads to
 *   - prerequisite_for: subjects in later semesters that depend on this
 *   - keywords: for TF-IDF matching with student queries
 *   - focus_reason: why AI recommends focus
 */

const CURRICULUM_KB = {

  // ═══════════════════════════════════════════
  // COMPUTER ENGINEERING (Department Code: CE)
  // ═══════════════════════════════════════════
  "Computer Engineering": {
    department_code: "CE",
    semesters: {

      1: [
        {
          code: "2301101T",
          name: "Calculus and Differential Equations",
          type: "BSC",
          credits: 3,
          importance_tier: 1,
          keywords: ["calculus", "differential equations", "integration", "derivatives", "limits", "mathematics", "maths", "math"],
          career_tags: ["software engineer", "data scientist", "ML engineer", "researcher"],
          prerequisite_for: ["Statistics and Integral Calculus", "Essentials of Data Science", "Applied Mathematics", "Design & Analysis of Algorithms"],
          focus_reason: "Foundation for all engineering mathematics. Critical for Data Science, ML, and Algorithm design in later semesters.",
          study_tips: ["Practice 10 problems daily", "Focus on Laplace transforms for engineering applications", "Link derivatives to rate-of-change problems in CS"]
        },
        {
          code: "2301102T",
          name: "Engineering Physics",
          type: "BSC",
          credits: 2,
          importance_tier: 2,
          keywords: ["physics", "waves", "optics", "semiconductors", "quantum", "lasers", "engineering physics"],
          career_tags: ["hardware engineer", "embedded systems", "IoT"],
          prerequisite_for: ["Computer Organization & Architecture", "Electrical and Electronics Engineering"],
          focus_reason: "Semiconductor physics directly applies to computer hardware understanding.",
          study_tips: ["Focus on semiconductor physics", "Understand quantum concepts for future computing trends"]
        },
        {
          code: "2307101T",
          name: "Electrical and Electronics Engineering",
          type: "ESC",
          credits: 2,
          importance_tier: 2,
          keywords: ["electrical", "electronics", "circuits", "diodes", "transistors", "logic gates", "EEE"],
          career_tags: ["embedded systems", "IoT developer", "hardware engineer"],
          prerequisite_for: ["Computer Organization & Architecture", "Digital Electronics"],
          focus_reason: "Logic gates and digital circuits are the basis of computer architecture.",
          study_tips: ["Master Boolean algebra", "Practice circuit diagrams", "Connect theory to digital logic"]
        },
        {
          code: "2304101T",
          name: "Foundations of Computing",
          type: "ESC",
          credits: 2,
          importance_tier: 1,
          keywords: ["programming", "C language", "algorithms", "computing", "problem solving", "flowchart", "pseudocode", "foundations", "FOC"],
          career_tags: ["software developer", "programmer", "all CS roles"],
          prerequisite_for: ["Data Structures", "Object Oriented Programming", "ALL programming subjects"],
          focus_reason: "THE most critical subject in Sem 1. Programming fundamentals are required for every CS subject ahead.",
          study_tips: ["Code daily, even simple programs", "Master loops, arrays, functions", "Practice on HackerRank/CodeChef"]
        },
        {
          code: "2304161T",
          name: "Linux Fundamentals and Programming",
          type: "VSEC",
          credits: 1,
          importance_tier: 2,
          keywords: ["linux", "unix", "shell", "terminal", "commands", "bash", "OS", "operating system"],
          career_tags: ["DevOps", "cloud engineer", "backend developer", "system admin"],
          prerequisite_for: ["Operating Systems", "Linux Administration-I", "Cloud Computing"],
          focus_reason: "Linux is used in 90% of servers. Essential for DevOps, Cloud, and Backend roles.",
          study_tips: ["Practice 5 Linux commands daily", "Set up Ubuntu on your PC", "Learn shell scripting basics"]
        },
        {
          code: "2304181T",
          name: "Indian Knowledge System (Vedic Mathematics)",
          type: "HSSM IKS",
          credits: 2,
          importance_tier: 3,
          keywords: ["vedic mathematics", "IKS", "Indian knowledge", "mental math", "calculation"],
          career_tags: ["competitive exams", "aptitude"],
          prerequisite_for: [],
          focus_reason: "Improves calculation speed useful in competitive programming and aptitude tests.",
          study_tips: ["Use Vedic sutras for fast multiplication", "Apply in competitive programming contests"]
        }
      ],

      2: [
        {
          code: "2301103T",
          name: "Statistics and Integral Calculus",
          type: "BSC",
          credits: 3,
          importance_tier: 1,
          keywords: ["statistics", "probability", "integral", "calculus", "mean", "variance", "distributions", "normal distribution", "stats"],
          career_tags: ["data scientist", "ML engineer", "data analyst", "researcher"],
          prerequisite_for: ["Essentials of Data Science", "Exploratory Data Analytics", "Artificial Intelligence Machine Learning", "Predictive Analytics"],
          focus_reason: "Probability and statistics are the backbone of Machine Learning and Data Science.",
          study_tips: ["Focus on probability distributions", "Practice integration techniques", "Connect to real data problems"]
        },
        {
          code: "2301104T",
          name: "Science of Nature",
          type: "BSC",
          credits: 3,
          importance_tier: 3,
          keywords: ["science", "nature", "environment", "sustainability", "biology", "ecology"],
          career_tags: ["green tech", "sustainability"],
          prerequisite_for: [],
          focus_reason: "Builds scientific thinking and environmental awareness.",
          study_tips: ["Connect concepts to real-world sustainability problems"]
        },
        {
          code: "2304102T",
          name: "Essentials of Data Science",
          type: "ESC",
          credits: 2,
          importance_tier: 1,
          keywords: ["data science", "python", "pandas", "numpy", "data analysis", "visualization", "EDA", "data", "datasets"],
          career_tags: ["data scientist", "data analyst", "ML engineer", "AI engineer"],
          prerequisite_for: ["Exploratory Data Analytics", "Predictive Analytics", "Big Data Analytics", "Artificial Intelligence Machine Learning"],
          focus_reason: "Data Science is the fastest-growing field. This intro course is critical gateway to AI/ML tracks.",
          study_tips: ["Install Python, Jupyter Notebook", "Practice with Kaggle datasets", "Learn pandas and matplotlib"]
        },
        {
          code: "2303101T",
          name: "Applied Mechanics",
          type: "ESC",
          credits: 2,
          importance_tier: 3,
          keywords: ["mechanics", "forces", "statics", "dynamics", "structural"],
          career_tags: ["interdisciplinary", "robotics"],
          prerequisite_for: [],
          focus_reason: "Useful for robotics and simulation applications.",
          study_tips: ["Solve numerical problems systematically"]
        },
        {
          code: "2309101T",
          name: "Design Thinking",
          type: "ESC",
          credits: 1,
          importance_tier: 2,
          keywords: ["design thinking", "problem solving", "innovation", "user experience", "empathy", "prototype", "UX", "design"],
          career_tags: ["product manager", "UX designer", "entrepreneur", "startup"],
          prerequisite_for: ["Project Design", "Major Projects"],
          focus_reason: "Design Thinking is the framework behind successful product companies like Apple, Google. Critical for project work.",
          study_tips: ["Apply 5-stage design thinking to your mini-projects", "Participate in hackathons"]
        },
        {
          code: "2304162T",
          name: "Data Visualization",
          type: "VSEC",
          credits: 1,
          importance_tier: 2,
          keywords: ["visualization", "charts", "graphs", "matplotlib", "tableau", "power BI", "data viz", "dashboards"],
          career_tags: ["data analyst", "business analyst", "data scientist"],
          prerequisite_for: ["Exploratory Data Analytics", "Predictive Analytics"],
          focus_reason: "Visualizing data is key to data storytelling. Used in every data role.",
          study_tips: ["Practice with Matplotlib, Seaborn", "Build a portfolio of data visualizations"]
        },
        {
          code: "2304111T",
          name: "Discrete Structure",
          type: "PCC",
          credits: 2,
          importance_tier: 1,
          keywords: ["discrete mathematics", "discrete structure", "graph theory", "logic", "sets", "relations", "combinatorics", "boolean algebra", "DS", "DM"],
          career_tags: ["software engineer", "algorithm designer", "cryptographer"],
          prerequisite_for: ["Theory of Computation", "Data Structures", "Design & Analysis of Algorithms", "Cryptography"],
          focus_reason: "Discrete Math is the mathematical foundation of ALL computer science. Theory of Computation and Algorithms depend on it.",
          study_tips: ["Master graph theory concepts", "Practice proofs", "Connect boolean algebra to programming logic"]
        }
      ],

      3: [
        {
          code: "2304212T",
          name: "Data Structures",
          type: "PCC",
          credits: 3,
          importance_tier: 1,
          keywords: ["data structures", "arrays", "linked list", "trees", "graphs", "stacks", "queues", "BST", "DSA", "sorting", "searching"],
          career_tags: ["software engineer", "backend developer", "competitive programmer", "all tech roles"],
          prerequisite_for: ["Advanced Data Structures", "Design & Analysis of Algorithms", "Database Management System", "Operating Systems"],
          focus_reason: "DSA is asked in EVERY technical interview at Google, Amazon, Microsoft, etc. This is THE most important Sem 3 subject.",
          study_tips: ["Practice on LeetCode daily", "Understand time/space complexity", "Implement all structures from scratch"]
        },
        {
          code: "2304221T",
          name: "Computer Organization & Architecture",
          type: "PCC",
          credits: 1,
          importance_tier: 2,
          keywords: ["COA", "computer organization", "architecture", "CPU", "memory", "cache", "instruction set", "pipeline", "registers"],
          career_tags: ["system programmer", "embedded developer", "hardware engineer"],
          prerequisite_for: ["Operating Systems", "Compiler Design", "Distributed Systems"],
          focus_reason: "Understanding how computers work internally is critical for OS and systems programming.",
          study_tips: ["Understand the fetch-decode-execute cycle", "Study memory hierarchy carefully"]
        },
        {
          code: "2304218T",
          name: "Computer Graphics",
          type: "PCC",
          credits: 2,
          importance_tier: 2,
          keywords: ["computer graphics", "OpenGL", "2D", "3D", "rendering", "transformations", "pixels", "GPU", "CG"],
          career_tags: ["game developer", "UI/UX engineer", "AR/VR developer", "animation"],
          prerequisite_for: ["UI/UX Design", "Mobile Application Development"],
          focus_reason: "Foundation for game development, AR/VR, and advanced UI development.",
          study_tips: ["Build simple OpenGL projects", "Understand transformation matrices"]
        },
        {
          code: "2304261L",
          name: "Problem Solving Using OOP (C++/Java)",
          type: "VSEC",
          credits: 2,
          importance_tier: 1,
          keywords: ["OOP", "object oriented", "C++", "Java", "classes", "objects", "inheritance", "polymorphism", "encapsulation", "abstraction"],
          career_tags: ["software developer", "backend developer", "all tech roles"],
          prerequisite_for: ["Advanced Data Structures", "Database Management System", "Software Engineering", "all development subjects"],
          focus_reason: "OOP is used in 95% of software development. Critical for all coding interviews and projects.",
          study_tips: ["Build small projects using OOP", "Understand SOLID principles", "Practice design patterns"]
        },
        {
          code: "2301276",
          name: "Entrepreneurship Skills",
          type: "HSSM MEC",
          credits: 2,
          importance_tier: 2,
          keywords: ["entrepreneurship", "startup", "business", "innovation", "lean startup", "MVP", "funding"],
          career_tags: ["entrepreneur", "founder", "product manager", "startup"],
          prerequisite_for: ["Project Management"],
          focus_reason: "Tech entrepreneurship is booming. This gives you the mindset to build your own startup.",
          study_tips: ["Read startup case studies", "Think of real-world problems you can solve with tech"]
        }
      ],

      4: [
        {
          code: "2304219T",
          name: "Advanced Data Structures",
          type: "PCC",
          credits: 2,
          importance_tier: 1,
          keywords: ["advanced data structures", "AVL tree", "red black tree", "heap", "trie", "segment tree", "ADS"],
          career_tags: ["software engineer", "competitive programmer", "backend developer"],
          prerequisite_for: ["Design & Analysis of Algorithms"],
          focus_reason: "Advanced DSA is tested in FAANG interviews. AVL trees, heaps, and tries are common interview questions.",
          study_tips: ["Implement AVL rotations", "Practice on Codeforces", "Understand when to use which structure"]
        },
        {
          code: "2304216T",
          name: "Database Management System",
          type: "PCC",
          credits: 3,
          importance_tier: 1,
          keywords: ["DBMS", "database", "SQL", "MySQL", "PostgreSQL", "normalization", "transactions", "ACID", "ER diagram", "queries", "joins"],
          career_tags: ["backend developer", "full stack developer", "data engineer", "DBA", "data analyst"],
          prerequisite_for: ["Cloud Computing", "Big Data Analytics", "Software Engineering projects"],
          focus_reason: "Every application uses a database. SQL is asked in 80% of tech interviews. Critical for backend and data roles.",
          study_tips: ["Practice 50 SQL queries on HackerRank", "Understand ACID properties", "Build a mini project with MySQL"]
        },
        {
          code: "2304220T",
          name: "Theory of Computation",
          type: "PCC",
          credits: 3,
          importance_tier: 2,
          keywords: ["TOC", "theory of computation", "automata", "finite automata", "DFA", "NFA", "Turing machine", "context free grammar", "CFG", "PDA", "regular expressions"],
          career_tags: ["compiler engineer", "language designer", "researcher"],
          prerequisite_for: ["Compiler Design"],
          focus_reason: "Foundation for Compiler Design and understanding programming language theory.",
          study_tips: ["Draw automata diagrams", "Understand pumping lemma", "Connect to regex in programming"]
        },
        {
          code: "2304268L",
          name: "Object Oriented Programming (Core Java)",
          type: "VSEC",
          credits: 2,
          importance_tier: 1,
          keywords: ["Java", "core Java", "JVM", "collections", "multithreading", "exception handling", "generics", "OOP Java"],
          career_tags: ["Java developer", "Android developer", "backend developer", "enterprise developer"],
          prerequisite_for: ["Enterprise Application Development", "Mobile Application Development"],
          focus_reason: "Java is used in Android, enterprise applications, and is frequently tested in interviews.",
          study_tips: ["Build a Java console application", "Understand JVM internals", "Practice multithreading problems"]
        },
        {
          code: "2301286T",
          name: "Environmental Science",
          type: "HSSM VEC",
          credits: 2,
          importance_tier: 3,
          keywords: ["environment", "sustainability", "green computing", "carbon footprint", "ecology"],
          career_tags: ["green tech", "sustainable software"],
          prerequisite_for: [],
          focus_reason: "Green computing is an emerging field. Understanding environmental impact of technology matters.",
          study_tips: ["Think about energy-efficient algorithms"]
        }
      ],

      5: [
        {
          code: "2304311T",
          name: "Operating Systems",
          type: "PCC",
          credits: 3,
          importance_tier: 1,
          keywords: ["OS", "operating system", "process", "thread", "scheduling", "memory management", "paging", "deadlock", "semaphore", "file system", "virtual memory"],
          career_tags: ["system programmer", "backend developer", "DevOps", "cloud engineer", "all tech roles"],
          prerequisite_for: ["Distributed Systems", "Cloud Computing", "Computer Networks"],
          focus_reason: "OS concepts like processes, memory, and scheduling are asked in every systems-level interview. Essential for all roles.",
          study_tips: ["Implement a mini scheduler", "Understand the Linux kernel basics", "Practice OS numerical problems (CPU scheduling, page replacement)"]
        },
        {
          code: "2304312T",
          name: "Computer Networks",
          type: "PCC",
          credits: 3,
          importance_tier: 1,
          keywords: ["computer networks", "TCP", "IP", "UDP", "HTTP", "DNS", "OSI model", "routing", "networking", "protocols", "CN", "socket programming"],
          career_tags: ["network engineer", "backend developer", "DevOps", "cloud architect", "cybersecurity"],
          prerequisite_for: ["Distributed Systems", "Cloud Computing", "Cyber Security", "Web Development"],
          focus_reason: "Networking is fundamental to the internet, cloud, and distributed systems. Every web application depends on network protocols.",
          study_tips: ["Build a client-server socket program", "Understand TCP vs UDP practically", "Study the OSI model thoroughly"]
        },
        {
          code: "2304321T",
          name: "Exploratory Data Analytics",
          type: "PEC",
          credits: 3,
          importance_tier: 1,
          keywords: ["EDA", "data analytics", "exploratory analysis", "pandas", "statistics", "data cleaning", "feature engineering", "visualization", "data exploration"],
          career_tags: ["data scientist", "data analyst", "ML engineer"],
          prerequisite_for: ["Predictive Analytics", "Deep Learning", "Big Data Analytics"],
          focus_reason: "EDA is step 1 in any ML project. Mastering data exploration makes you a strong data professional.",
          study_tips: ["Complete 3 Kaggle EDA notebooks", "Practice with real datasets", "Document your findings clearly"]
        },
        {
          code: "2304322T",
          name: "Artificial Intelligence Machine Learning",
          type: "PEC",
          credits: 3,
          importance_tier: 1,
          keywords: ["AI", "ML", "machine learning", "artificial intelligence", "supervised learning", "unsupervised", "neural networks", "classification", "regression", "sklearn", "deep learning basics"],
          career_tags: ["ML engineer", "AI engineer", "data scientist", "research scientist"],
          prerequisite_for: ["Deep Learning", "Generative AI", "Predictive Analytics"],
          focus_reason: "AI/ML is the hottest tech field. Companies are hiring ML engineers at 2-3x the salary of regular developers.",
          study_tips: ["Build end-to-end ML projects", "Learn scikit-learn", "Take Andrew Ng's ML course on Coursera"]
        },
        {
          code: "2304323T",
          name: "Cloud Computing Foundation",
          type: "PEC",
          credits: 3,
          importance_tier: 1,
          keywords: ["cloud", "AWS", "Azure", "GCP", "cloud computing", "IaaS", "PaaS", "SaaS", "serverless", "containers", "kubernetes", "docker"],
          career_tags: ["cloud engineer", "DevOps engineer", "cloud architect", "backend developer"],
          prerequisite_for: ["Cloud Native Application Development", "Cloud Native DevOps"],
          focus_reason: "90% of modern applications run on cloud. AWS/Azure/GCP certifications can boost salary by 40%.",
          study_tips: ["Create an AWS free tier account", "Deploy a small application", "Prepare for AWS Cloud Practitioner certification"]
        },
        {
          code: "2304324T",
          name: "Cryptography and Information Security",
          type: "PEC",
          credits: 3,
          importance_tier: 2,
          keywords: ["cryptography", "encryption", "decryption", "RSA", "AES", "cybersecurity", "hashing", "SSL", "TLS", "information security", "crypto"],
          career_tags: ["cybersecurity analyst", "security engineer", "ethical hacker"],
          prerequisite_for: ["Cyber Security & Forensics", "Ethical Hacking & Cyber Laws"],
          focus_reason: "Cybersecurity is a rapidly growing field with massive talent shortage. This course is your entry point.",
          study_tips: ["Understand RSA and AES mathematically", "Practice on TryHackMe platform", "Study real-world security breaches"]
        }
      ],

      6: [
        {
          code: "2304313T",
          name: "Software Engineering",
          type: "PCC",
          credits: 3,
          importance_tier: 1,
          keywords: ["software engineering", "SDLC", "agile", "scrum", "software development", "requirements", "testing", "design patterns", "UML", "SE"],
          career_tags: ["software engineer", "project manager", "tech lead", "all dev roles"],
          prerequisite_for: ["Major Projects", "Capstone Project"],
          focus_reason: "Industry-standard development processes. Every software job requires understanding of SDLC, Agile, and testing.",
          study_tips: ["Implement a project using Agile sprints", "Learn UML diagrams", "Practice writing test cases"]
        },
        {
          code: "2304314T",
          name: "Design & Analysis of Algorithms",
          type: "PCC",
          credits: 3,
          importance_tier: 1,
          keywords: ["DAA", "algorithms", "dynamic programming", "greedy", "divide conquer", "graph algorithms", "complexity", "big O", "NP complete", "algorithm design"],
          career_tags: ["software engineer", "competitive programmer", "researcher", "FAANG"],
          prerequisite_for: ["All competitive programming", "Research roles"],
          focus_reason: "DAA is THE subject for cracking FAANG/product company interviews. Dynamic programming is asked at Google, Amazon, etc.",
          study_tips: ["Solve 100 LeetCode problems covering each topic", "Understand time complexity proofs", "Practice DP patterns: knapsack, LCS, LIS"]
        },
        {
          code: "2304326T",
          name: "Predictive Analytics",
          type: "PEC",
          credits: 3,
          importance_tier: 1,
          keywords: ["predictive analytics", "regression", "forecasting", "time series", "prediction models", "ML models", "linear regression", "logistic regression"],
          career_tags: ["data scientist", "ML engineer", "business analyst", "quant analyst"],
          prerequisite_for: ["Big Data Analytics", "Generative AI Applications"],
          focus_reason: "Predictive modeling is used in finance, healthcare, e-commerce. High-demand data science skill.",
          study_tips: ["Build a stock price prediction model", "Kaggle competitions on regression"]
        },
        {
          code: "2304327T",
          name: "Deep Learning",
          type: "PEC",
          credits: 3,
          importance_tier: 1,
          keywords: ["deep learning", "neural networks", "CNN", "RNN", "LSTM", "transformers", "backpropagation", "tensorflow", "pytorch", "DL"],
          career_tags: ["AI engineer", "ML engineer", "computer vision", "NLP engineer"],
          prerequisite_for: ["Generative AI Applications"],
          focus_reason: "Deep Learning powers ChatGPT, image recognition, self-driving cars. One of the highest-paying tech specializations.",
          study_tips: ["Complete fast.ai or deep learning specialization", "Build CNN for image classification", "Experiment with PyTorch"]
        },
        {
          code: "2304328T",
          name: "Cloud Native Application Development",
          type: "PEC",
          credits: 3,
          importance_tier: 2,
          keywords: ["cloud native", "microservices", "docker", "kubernetes", "API gateway", "serverless", "cloud development"],
          career_tags: ["cloud developer", "DevOps engineer", "backend developer"],
          prerequisite_for: ["Cloud Native DevOps"],
          focus_reason: "Modern applications are built cloud-native. Essential for backend and DevOps roles.",
          study_tips: ["Deploy a microservice using Docker", "Learn Kubernetes basics"]
        },
        {
          code: "2304329T",
          name: "Cyber Security & Forensics",
          type: "PEC",
          credits: 3,
          importance_tier: 2,
          keywords: ["cyber security", "forensics", "digital forensics", "incident response", "malware", "penetration testing", "SOC"],
          career_tags: ["cybersecurity analyst", "forensic analyst", "security engineer"],
          prerequisite_for: ["Ethical Hacking & Cyber Laws"],
          focus_reason: "Cybercrime is rising exponentially. Security professionals are extremely scarce and well-paid.",
          study_tips: ["Practice on HackTheBox", "Study OWASP Top 10", "Learn Wireshark for traffic analysis"]
        }
      ],

      7: [
        {
          code: "2304411T",
          name: "Distributed Systems",
          type: "PCC",
          credits: 3,
          importance_tier: 1,
          keywords: ["distributed systems", "distributed computing", "consensus", "CAP theorem", "fault tolerance", "replication", "map reduce", "microservices", "DS"],
          career_tags: ["backend engineer", "systems engineer", "cloud architect", "FAANG"],
          prerequisite_for: ["Capstone Project", "Semester Long Internship"],
          focus_reason: "Every large-scale system (Google, Amazon, Netflix) is distributed. Critical for senior and FAANG roles.",
          study_tips: ["Study the Google Bigtable paper", "Understand CAP theorem deeply", "Build a simple distributed key-value store"]
        },
        {
          code: "2304421T",
          name: "Big Data Analytics",
          type: "PEC",
          credits: 3,
          importance_tier: 2,
          keywords: ["big data", "Hadoop", "Spark", "MapReduce", "data lake", "ETL", "batch processing", "stream processing", "Hive", "Kafka"],
          career_tags: ["data engineer", "big data architect", "data scientist"],
          prerequisite_for: [],
          focus_reason: "Big Data technologies are used by every major tech company for processing petabytes of data.",
          study_tips: ["Learn Apache Spark with Python", "Build an ETL pipeline", "Study data lake architectures"]
        },
        {
          code: "2304422T",
          name: "Generative AI Applications",
          type: "PEC",
          credits: 3,
          importance_tier: 1,
          keywords: ["generative AI", "LLM", "GPT", "chatGPT", "stable diffusion", "prompt engineering", "RAG", "fine tuning", "GenAI", "large language models"],
          career_tags: ["AI engineer", "ML engineer", "product engineer", "AI researcher"],
          prerequisite_for: [],
          focus_reason: "Generative AI is transforming every industry. GenAI engineers are among the highest-paid professionals in 2024-2026.",
          study_tips: ["Build a RAG application", "Learn LangChain", "Experiment with OpenAI API", "Study prompt engineering techniques"]
        },
        {
          code: "2304423T",
          name: "Cloud Native DevOps",
          type: "PEC",
          credits: 3,
          importance_tier: 2,
          keywords: ["DevOps", "CI/CD", "Jenkins", "GitHub Actions", "Terraform", "IaC", "monitoring", "logging", "DevSecOps"],
          career_tags: ["DevOps engineer", "SRE", "platform engineer"],
          prerequisite_for: [],
          focus_reason: "DevOps is a standalone career path with excellent salaries. CI/CD knowledge is expected at all tech companies.",
          study_tips: ["Build a CI/CD pipeline with GitHub Actions", "Learn Terraform basics", "Get AWS DevOps certification"]
        },
        {
          code: "2304424T",
          name: "Ethical Hacking & Cyber Laws",
          type: "PEC",
          credits: 3,
          importance_tier: 2,
          keywords: ["ethical hacking", "penetration testing", "bug bounty", "cyber laws", "VAPT", "CEH", "kali linux", "exploitation"],
          career_tags: ["ethical hacker", "penetration tester", "security consultant"],
          prerequisite_for: [],
          focus_reason: "Bug bounty programs at Google, Meta pay lakhs per bug found. Ethical hacking is a lucrative career.",
          study_tips: ["Get Kali Linux", "Practice on TryHackMe", "Participate in CTF competitions"]
        },
        {
          code: "2304491L",
          name: "Major Project - III",
          type: "ELC PRJ",
          credits: 2,
          importance_tier: 1,
          keywords: ["project", "major project", "final year project", "capstone", "research project"],
          career_tags: ["all roles"],
          prerequisite_for: ["Capstone Project"],
          focus_reason: "Your project is what you show employers. A great project can get you placed even without a high GPA.",
          study_tips: ["Choose a problem that solves a real issue", "Use latest technologies", "Document everything properly"]
        }
      ],

      8: [
        {
          code: "2304413T",
          name: "Compiler Design",
          type: "PCC",
          credits: 3,
          importance_tier: 2,
          keywords: ["compiler", "lexical analysis", "parsing", "syntax", "semantic analysis", "code generation", "compilers", "LEX", "YACC"],
          career_tags: ["compiler engineer", "language designer", "systems programmer", "researcher"],
          prerequisite_for: [],
          focus_reason: "Compiler knowledge is highly valued at companies building programming tools and languages.",
          study_tips: ["Build a simple calculator using LEX/YACC", "Understand parsing techniques deeply"]
        },
        {
          code: "2304497L",
          name: "Semester Long Internship / Capstone Project",
          type: "ELC SI",
          credits: 8,
          importance_tier: 1,
          keywords: ["internship", "capstone", "project", "industry", "placement", "final project", "semester internship"],
          career_tags: ["all roles", "placement"],
          prerequisite_for: [],
          focus_reason: "8 credits! This IS your gateway to placement. A strong internship/capstone project is the #1 factor in getting hired.",
          study_tips: ["Choose an industry mentor", "Work on a real problem", "Document your contributions for resume"]
        },
        {
          code: "2301451L",
          name: "Professional Certification Course",
          type: "OE",
          credits: 2,
          importance_tier: 1,
          keywords: ["certification", "AWS", "Azure", "Google", "professional", "certificate", "industry certification"],
          career_tags: ["all roles", "placement boost"],
          prerequisite_for: [],
          focus_reason: "Industry certifications (AWS, Azure, Google Cloud) immediately boost your resume and salary by 20-30%.",
          study_tips: ["Aim for AWS Cloud Practitioner or Azure Fundamentals", "Use free resources from official portals"]
        }
      ]
    }
  },

  // ═══════════════════════════════════════════════════════
  // INFORMATION TECHNOLOGY (Department Code: IT)
  // ═══════════════════════════════════════════════════════
  "Information Technology": {
    department_code: "IT",
    semesters: {
      1: [
        {
          code: "2301101T",
          name: "Calculus and Differential Equations",
          type: "BSC", credits: 3, importance_tier: 1,
          keywords: ["calculus", "differential equations", "mathematics", "maths", "derivatives", "limits"],
          career_tags: ["data scientist", "ML engineer", "all IT roles"],
          prerequisite_for: ["Statistics", "Applied Mathematics"],
          focus_reason: "Mathematical foundation required for all IT analytical roles.",
          study_tips: ["Practice integration techniques daily", "Link calculus to real engineering problems"]
        },
        {
          code: "2304101T",
          name: "Foundations of Computing",
          type: "ESC", credits: 2, importance_tier: 1,
          keywords: ["programming", "C", "coding", "problem solving", "algorithms", "foundations", "FOC"],
          career_tags: ["all IT roles"],
          prerequisite_for: ["All programming subjects"],
          focus_reason: "Core programming fundamentals needed for all IT subjects.",
          study_tips: ["Code in C daily", "Practice on competitive coding platforms"]
        }
      ],
      2: [
        {
          code: "2304111T",
          name: "Discrete Structure",
          type: "PCC", credits: 2, importance_tier: 1,
          keywords: ["discrete math", "graph theory", "logic", "sets", "discrete structure"],
          career_tags: ["software engineer", "all IT roles"],
          prerequisite_for: ["Theory of Computation", "Algorithms"],
          focus_reason: "Mathematical backbone of all computer science theory.",
          study_tips: ["Master Boolean algebra and graph theory"]
        }
      ],
      3: [
        {
          code: "2304212T",
          name: "Data Structures",
          type: "PCC", credits: 3, importance_tier: 1,
          keywords: ["data structures", "DSA", "trees", "graphs", "arrays", "linked lists"],
          career_tags: ["all IT roles"],
          prerequisite_for: ["Algorithms", "Database Systems"],
          focus_reason: "DSA is mandatory for all tech interviews.",
          study_tips: ["LeetCode daily practice is essential"]
        }
      ],
      4: [
        {
          code: "2304216T",
          name: "Database Management System",
          type: "PCC", credits: 3, importance_tier: 1,
          keywords: ["DBMS", "SQL", "database", "MySQL", "normalization"],
          career_tags: ["backend developer", "full stack", "data engineer"],
          prerequisite_for: ["Cloud Computing", "Big Data"],
          focus_reason: "Every IT application uses databases. SQL is mandatory skill.",
          study_tips: ["Practice 50 SQL queries", "Build a complete database schema"]
        }
      ],
      5: [
        {
          code: "2304311T",
          name: "Operating Systems",
          type: "PCC", credits: 3, importance_tier: 1,
          keywords: ["OS", "operating system", "processes", "threads", "scheduling", "memory management"],
          career_tags: ["all IT roles"],
          prerequisite_for: ["Distributed Systems", "Cloud Computing"],
          focus_reason: "OS fundamentals are tested in all systems-level interviews.",
          study_tips: ["Implement process scheduling algorithms"]
        },
        {
          code: "2304312T",
          name: "Computer Networks",
          type: "PCC", credits: 3, importance_tier: 1,
          keywords: ["networking", "TCP/IP", "protocols", "OSI", "routing", "computer networks"],
          career_tags: ["network engineer", "backend developer", "cloud engineer"],
          prerequisite_for: ["Cloud Computing", "Distributed Systems"],
          focus_reason: "Networking knowledge is essential for cloud and distributed system roles.",
          study_tips: ["Build socket programs", "Study OSI model thoroughly"]
        }
      ],
      6: [
        {
          code: "2304313T",
          name: "Software Engineering",
          type: "PCC", credits: 3, importance_tier: 1,
          keywords: ["software engineering", "agile", "SDLC", "testing", "SE"],
          career_tags: ["software engineer", "all IT roles"],
          prerequisite_for: ["Major Projects"],
          focus_reason: "Agile and SDLC knowledge is expected in every software company.",
          study_tips: ["Practice writing test cases", "Learn UML diagrams"]
        }
      ],
      7: [
        {
          code: "2304411T",
          name: "Distributed Systems",
          type: "PCC", credits: 3, importance_tier: 1,
          keywords: ["distributed systems", "cloud", "microservices", "CAP theorem"],
          career_tags: ["backend engineer", "cloud architect"],
          prerequisite_for: [],
          focus_reason: "Large-scale IT systems are all distributed. Critical for senior roles.",
          study_tips: ["Study CAP theorem", "Build a simple distributed app"]
        }
      ],
      8: [
        {
          code: "2304497L",
          name: "Semester Long Internship / Capstone Project",
          type: "ELC SI", credits: 8, importance_tier: 1,
          keywords: ["internship", "capstone", "project", "placement"],
          career_tags: ["all roles"],
          prerequisite_for: [],
          focus_reason: "Highest credit subject. Your industry experience is the key to placement.",
          study_tips: ["Work on impactful industry problem", "Build strong portfolio documentation"]
        }
      ]
    }
  },

  // ═══════════════════════════════════════════════════════
  // ELECTRONICS & TELECOMMUNICATION ENGINEERING (ENTC)
  // ═══════════════════════════════════════════════════════
  "Electronics & Telecommunication": {
    department_code: "ENTC",
    semesters: {
      1: [
        {
          code: "2307101T",
          name: "Electrical and Electronics Engineering",
          type: "ESC", credits: 2, importance_tier: 1,
          keywords: ["electronics", "electrical", "circuits", "diodes", "transistors", "EEE"],
          career_tags: ["electronics engineer", "embedded systems", "IoT"],
          prerequisite_for: ["Digital Electronics", "Signal Processing"],
          focus_reason: "Foundation of all electronics. Every ENTC subject builds on this.",
          study_tips: ["Master circuit analysis techniques", "Practice KVL and KCL problems"]
        }
      ],
      5: [
        {
          code: "2304311T",
          name: "Operating Systems",
          type: "PCC", credits: 3, importance_tier: 2,
          keywords: ["OS", "embedded OS", "RTOS", "operating systems"],
          career_tags: ["embedded systems engineer", "IoT developer"],
          prerequisite_for: [],
          focus_reason: "Real-Time OS (RTOS) is critical for embedded and IoT roles in ENTC.",
          study_tips: ["Study RTOS concepts specifically", "Practice with FreeRTOS"]
        }
      ]
    }
  },

  // ═══════════════════════════════════════════════════════
  // MECHANICAL ENGINEERING (MECH)
  // ═══════════════════════════════════════════════════════
  "Mechanical Engineering": {
    department_code: "MECH",
    semesters: {
      2: [
        {
          code: "2303101T",
          name: "Applied Mechanics",
          type: "ESC", credits: 2, importance_tier: 1,
          keywords: ["mechanics", "statics", "dynamics", "forces", "structural", "applied mechanics"],
          career_tags: ["mechanical engineer", "structural engineer", "manufacturing"],
          prerequisite_for: ["Strength of Materials", "Machine Design"],
          focus_reason: "Core foundation of all mechanical engineering subjects.",
          study_tips: ["Solve free body diagrams systematically", "Practice numerical problems daily"]
        }
      ]
    }
  },

  // ═══════════════════════════════════════════════════════
  // CIVIL ENGINEERING (CIVIL)
  // ═══════════════════════════════════════════════════════
  "Civil Engineering": {
    department_code: "CIVIL",
    semesters: {
      2: [
        {
          code: "2303101T",
          name: "Applied Mechanics",
          type: "ESC", credits: 2, importance_tier: 1,
          keywords: ["mechanics", "statics", "civil", "structural", "forces", "applied mechanics"],
          career_tags: ["civil engineer", "structural engineer", "construction manager"],
          prerequisite_for: ["Structural Analysis", "RCC Design"],
          focus_reason: "Every civil engineering structure depends on mechanics principles.",
          study_tips: ["Master equilibrium concepts", "Practice beam and truss problems"]
        }
      ]
    }
  },

  // ═══════════════════════════════════════════════════════
  // CHEMICAL ENGINEERING (CHEM)
  // ═══════════════════════════════════════════════════════
  "Chemical Engineering": {
    department_code: "CHEM",
    semesters: {
      1: [
        {
          code: "2301102T",
          name: "Engineering Physics",
          type: "BSC", credits: 2, importance_tier: 1,
          keywords: ["physics", "thermodynamics", "waves", "engineering physics"],
          career_tags: ["chemical engineer", "process engineer"],
          prerequisite_for: ["Mass Transfer", "Heat Transfer", "Thermodynamics"],
          focus_reason: "Thermodynamics and heat transfer are fundamental to chemical processes.",
          study_tips: ["Focus on thermodynamic laws", "Practice heat transfer calculations"]
        }
      ]
    }
  }
};

/**
 * IMPORTANCE TIER DESCRIPTIONS
 * Used for UI display in student dashboard
 */
const TIER_CONFIG = {
  1: {
    label: "🔴 Critical Focus",
    color: "#dc2626",
    bg: "#fee2e2",
    border: "#fecaca",
    description: "This subject is foundational and directly impacts your career readiness. Prioritize it above all others."
  },
  2: {
    label: "🟡 Important",
    color: "#d97706",
    bg: "#fef3c7",
    border: "#fde68a",
    description: "This subject is important for your academic progression and some career paths."
  },
  3: {
    label: "🟢 Standard",
    color: "#16a34a",
    bg: "#d1fae5",
    border: "#a7f3d0",
    description: "Complete this subject as per curriculum requirements."
  }
};

/**
 * CAREER PATH DEFINITIONS
 * Maps career interests to high-priority subjects
 */
const CAREER_PATHS = {
  "software_engineer": {
    label: "Software Engineer (Product Companies / FAANG)",
    priority_subjects: ["Data Structures", "Design & Analysis of Algorithms", "Operating Systems", "Computer Networks", "Database Management System", "Object Oriented Programming"],
    certifications: ["LeetCode Premium", "Codeforces", "HackerRank"],
    avg_salary: "₹12-40 LPA"
  },
  "data_scientist": {
    label: "Data Scientist / ML Engineer",
    priority_subjects: ["Statistics and Integral Calculus", "Essentials of Data Science", "Exploratory Data Analytics", "Artificial Intelligence Machine Learning", "Predictive Analytics", "Deep Learning"],
    certifications: ["Google ML Certificate", "Kaggle Competitions", "AWS ML Specialty"],
    avg_salary: "₹10-35 LPA"
  },
  "cloud_devops": {
    label: "Cloud / DevOps Engineer",
    priority_subjects: ["Computer Networks", "Operating Systems", "Cloud Computing Foundation", "Cloud Native Application Development", "Linux Fundamentals"],
    certifications: ["AWS Cloud Practitioner", "Azure Fundamentals", "CKA (Kubernetes)"],
    avg_salary: "₹10-30 LPA"
  },
  "cybersecurity": {
    label: "Cybersecurity / Ethical Hacker",
    priority_subjects: ["Computer Networks", "Operating Systems", "Cryptography and Information Security", "Cyber Security & Forensics", "Ethical Hacking & Cyber Laws"],
    certifications: ["CEH", "CompTIA Security+", "OSCP"],
    avg_salary: "₹8-25 LPA"
  },
  "full_stack": {
    label: "Full Stack Developer",
    priority_subjects: ["Database Management System", "Object Oriented Programming", "Software Engineering", "Web Technology", "Operating Systems"],
    certifications: ["Meta Full Stack Certificate", "Full Stack Open (Helsinki)"],
    avg_salary: "₹6-20 LPA"
  }
};

module.exports = { CURRICULUM_KB, TIER_CONFIG, CAREER_PATHS };