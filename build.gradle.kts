plugins {
    base
}

tasks.register("checkAll") {
    dependsOn(":backend:check")
}
