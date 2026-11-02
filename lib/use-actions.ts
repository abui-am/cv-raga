"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queries } from "./queries";
import { profileApi } from "@/features/profile/api";
import { knowledgeApi } from "@/features/knowledge/api";
import { applicationsApi } from "@/features/applications/api";
import { cvsApi } from "@/features/cvs/api";
import type { Application, Cv } from "./contracts";

export function useSaveProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: profileApi.save,
    retry: false,
    onSuccess: async (data) => {
      client.setQueryData(queries.profile.detail.queryKey, data);
      await client.invalidateQueries({ queryKey: queries.knowledge._def });
    },
  });
}
export function useSaveEvidence() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: knowledgeApi.save,
    retry: false,
    onSuccess: async (data) => {
      client.setQueryData(queries.knowledge.detail(data.id).queryKey, data);
      await client.invalidateQueries({ queryKey: queries.knowledge._def });
    },
  });
}
export function useDeleteEvidence() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: knowledgeApi.delete,
    retry: false,
    onSuccess: async ({ id }) => {
      client.removeQueries({
        queryKey: queries.knowledge.detail(id).queryKey,
        exact: true,
      });
      await client.invalidateQueries({ queryKey: queries.knowledge.list._def });
    },
  });
}
export function useApplicationActions() {
  const client = useQueryClient();
  const onSuccess = async (data: Application) => {
    client.setQueryData(queries.applications.detail(data.id).queryKey, data);
    await Promise.all([
      client.invalidateQueries({ queryKey: queries.applications.list._def }),
      client.invalidateQueries({ queryKey: queries.cvs._def }),
      client.invalidateQueries({ queryKey: queries.assessments._def }),
    ]);
  };
  return {
    save: useMutation({
      mutationFn: applicationsApi.save,
      retry: false,
      onSuccess,
    }),
    analyze: useMutation({
      mutationFn: applicationsApi.analyze,
      retry: false,
      onSuccess,
    }),
  };
}
export function useCvActions() {
  const client = useQueryClient();
  const onSuccess = async (data: Cv) => {
    client.setQueryData(queries.cvs.detail(data.id).queryKey, data);
    await Promise.all([
      client.invalidateQueries({ queryKey: queries.cvs.list.queryKey }),
      client.invalidateQueries({ queryKey: queries.applications._def }),
      client.invalidateQueries({ queryKey: queries.assessments._def }),
    ]);
  };
  return {
    create: useMutation({ mutationFn: cvsApi.create, retry: false, onSuccess }),
    createForRole: useMutation({
      mutationFn: applicationsApi.createCv,
      retry: false,
      onSuccess,
    }),
    save: useMutation({ mutationFn: cvsApi.save, retry: false, onSuccess }),
    action: useMutation({
      mutationFn: cvsApi.action,
      retry: false,
      onSuccess: async (data, variables) => {
        await onSuccess(data);
        if (variables.action === "assistant")
          await Promise.all([
            client.invalidateQueries({ queryKey: queries.knowledge._def }),
            client.invalidateQueries({
              queryKey: queries.profile.sources.queryKey,
            }),
          ]);
      },
    }),
    saveLetter: useMutation({
      mutationFn: cvsApi.saveLetter,
      retry: false,
      onSuccess,
    }),
  };
}
