package com.c108.issueatlas.job.controller;

import com.c108.issueatlas.job.dto.JobResponse;
import com.c108.issueatlas.job.service.JobService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 관리자 전용 수집 이력(FR-F5). 권한은 경로({@code /v1/admin/**})로 보안 필터 체인에서만 판정한다. 재실행은 없다. */
@RestController
@RequestMapping("/v1/admin/jobs")
public class AdminJobController {
    private final JobService jobs;

    public AdminJobController(JobService jobs) {
        this.jobs = jobs;
    }

    @GetMapping
    public JobResponse.Page list(
            @RequestParam(required = false) String status,
            @RequestParam(name = "source_id", required = false) String sourceId,
            @RequestParam(name = "spec_id", required = false) String specId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return jobs.list(status, sourceId, specId, page, size);
    }

    @GetMapping("/{job_run_id}")
    public JobResponse.Single get(@PathVariable("job_run_id") String jobRunId) {
        return jobs.get(jobRunId);
    }
}
